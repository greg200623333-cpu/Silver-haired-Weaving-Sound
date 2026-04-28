import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 服务端写入（绕过 RLS，仅用于内部 API 路由的受控写入）
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// 客户端（遵循 RLS，用于需要行级安全的前端直连场景）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ================================================================
// 记忆上下文查询
// ================================================================
export async function getRecentMemories(elderId: string, limit = 3) {
  const { data, error } = await supabaseAdmin
    .from('memories')
    .select('polished_text, keywords, emotion_tag, time_points')
    .eq('elder_id', elderId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn(`[Supabase] getRecentMemories 查询异常: ${error.message}`);
    return [];
  }

  return data ?? [];
}

// ================================================================
// 写入记忆
// ================================================================
export async function insertMemory(params: {
  elderId: string;
  recordedBy?: string;
  voiceUrl?: string;
  rawText: string;
  polishedText: string;
  photoUrls?: string[];
  timePoints: { year: number; event: string }[];
  keywords: string[];
  emotion: string;
  durationSecs?: number;
  emotionScore?: number;
  idempotencyKey?: string;
}) {
  const { data, error } = await supabaseAdmin
    .from('memories')
    .insert({
      elder_id: params.elderId,
      recorded_by: params.recordedBy ?? null,
      voice_url: params.voiceUrl ?? null,
      raw_text: params.rawText,
      polished_text: params.polishedText,
      photo_urls: params.photoUrls ?? [],
      time_points: params.timePoints,
      keywords: params.keywords,
      emotion_tag: params.emotion,
      duration_secs: params.durationSecs ?? null,
      emotion_score: params.emotionScore ?? null,
      idempotency_key: params.idempotencyKey ?? null,
    })
    .select('id')
    .single();

  if (error) {
    // 等幂键冲突 → 返回已有记录而非抛错
    if (error.code === '23505' && error.message.includes('idempotency_key')) {
      console.warn(`[Supabase] 等幂键冲突，跳过重复写入: ${params.idempotencyKey}`);
      return { id: 'duplicate-skipped' };
    }
    throw new Error(`记忆写入失败: ${error.message}`);
  }
  return data;
}

// ================================================================
// 写入聊天记录（带等幂性保护）
// ================================================================
export async function insertChatLog(params: {
  elderId: string;
  role: 'elder' | 'assistant';
  content: string;
  memoryId?: string;
  emotionHint?: string;
  emotionScore?: number;
  idempotencyKey?: string;  // 新增：等幂键
}) {
  const insertData: any = {
    elder_id: params.elderId,
    role: params.role,
    content: params.content,
    memory_id: params.memoryId ?? null,
    emotion_hint: params.emotionHint ?? null,
    emotion_score: params.emotionScore ?? null,
  };

  // 如果提供了等幂键，添加到插入数据中
  if (params.idempotencyKey) {
    insertData.idempotency_key = params.idempotencyKey;
  }

  const { data, error } = await supabaseAdmin
    .from('chat_logs')
    .insert(insertData)
    .select('id')
    .single();

  // 等幂键冲突检测（23505 = unique_violation）
  if (error) {
    if (error.code === '23505' && params.idempotencyKey) {
      console.log(`[Supabase] 聊天记录已存在（等幂键: ${params.idempotencyKey.slice(0, 8)}），跳过`);
      return null;  // 返回 null 表示已存在
    }
    throw new Error(`聊天记录写入失败: ${error.message}`);
  }
  return data;
}

// ================================================================
// 处理日志写入（LLM 原始响应的持久化兜底）
// ================================================================
export async function insertProcessingLog(params: {
  elderId: string;
  rawText: string;
  llmResponse: string;
  status: 'pending' | 'completed' | 'failed';
}) {
  const { error } = await supabaseAdmin
    .from('processing_logs')
    .insert({
      elder_id: params.elderId,
      raw_text: params.rawText,
      llm_response: params.llmResponse,
      status: params.status,
    });

  if (error) console.warn(`[Supabase] processing_logs 写入失败: ${error.message}`);
}

// ================================================================
// 写入知识图谱实体与关系
export async function insertEntitiesAndRelations(
  memoryId: string,
  elderId: string,
  entities: Array<{ type: string; name: string; attributes: Record<string, string> }>,
  relations: Array<{ subject: string; predicate: string; object: string }>,
): Promise<void> {
  if (entities.length === 0) return;

  // 先写入实体，收集 name→id 映射
  const nameToId = new Map<string, string>();

  for (const e of entities) {
    const { data, error } = await supabaseAdmin
      .from('memory_entities')
      .insert({
        memory_id: memoryId,
        elder_id: elderId,
        entity_type: e.type,
        name: e.name,
        attributes: e.attributes ?? {},
      })
      .select('id')
      .single();

    if (!error && data) {
      nameToId.set(e.name, data.id);
    }
  }

  // 写入关系（需要 subject 和 object 都在 entities 中）
  for (const r of relations) {
    const subjectId = nameToId.get(r.subject);
    const objectId = nameToId.get(r.object);
    if (!subjectId || !objectId) continue;

    try {
      await supabaseAdmin
        .from('memory_relations')
        .insert({
          memory_id: memoryId,
          elder_id: elderId,
          subject_entity: subjectId,
          predicate: r.predicate,
          object_entity: objectId,
        })
        .select('id')
        .single();
    } catch { /* 唯一约束冲突静默跳过 */ }
  }
}

// 实体链接查询 —— 从当前对话中匹配相关历史实体（优化版）
export async function getRelevantEntities(
  elderId: string,
  searchTerms: string,
  limit = 10,
): Promise<Array<{ name: string; type: string; attributes: Record<string, any> }>> {
  const terms = searchTerms
    .replace(/[，。！？、；：""''（）\s]/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 2)
    .slice(0, 5);  // 最多取 5 个关键词

  if (terms.length === 0) return [];

  // 用 ILIKE 做简单实体匹配（生产环境可升级为 pgvector 语义搜索）
  const ilikeFilters = terms.map((t) => `name.ilike.%${t}%`);

  const { data } = await supabaseAdmin
    .from('memory_entities')
    .select('name, entity_type, attributes')
    .eq('elder_id', elderId)
    .or(ilikeFilters.join(','))
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 20));  // 硬限制最多 20 条，防止大数据量查询

  // 去重（同名实体只保留最新的）
  const seen = new Set<string>();
  const unique = (data ?? []).filter((e: any) => {
    if (seen.has(e.name)) return false;
    seen.add(e.name);
    return true;
  });

  return unique.map((e: any) => ({
    name: e.name,
    type: e.entity_type,
    attributes: e.attributes ?? {},
  }));
}

// 情绪异常检测 —— 连续 N 天仅有负面情绪 → 预警
export async function detectMoodAnomaly(
  elderId: string,
  days = 7,
): Promise<{ alerted: boolean; negativeStreak: number; dominantEmotion: string }> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('memories')
    .select('emotion_tag, emotion_score, created_at')
    .eq('elder_id', elderId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    return { alerted: false, negativeStreak: 0, dominantEmotion: '' };
  }

  const NEGATIVE_EMOTIONS = new Set(['感伤', '思念', '孤独']);
  let negativeStreak = 0;
  const emotionCounts = new Map<string, number>();

  for (const row of data) {
    const tag = row.emotion_tag as string;
    emotionCounts.set(tag, (emotionCounts.get(tag) ?? 0) + 1);
    if (NEGATIVE_EMOTIONS.has(tag)) {
      negativeStreak++;
    } else {
      break; // 遇到非负面情绪即中断连续计数
    }
  }

  let dominantEmotion = '';
  let maxCount = 0;
  for (const [tag, cnt] of emotionCounts) {
    if (cnt > maxCount) { maxCount = cnt; dominantEmotion = tag; }
  }

  const alerted = negativeStreak >= 3; // 连续 3 条以上负面情绪 → 预警

  return { alerted, negativeStreak, dominantEmotion };
}

// 情绪聚合 —— 供子女端情绪热力图直接使用
// ================================================================
export async function getEmotionTimeline(
  elderId: string,
  days = 90,
): Promise<Array<{ day: string; emotion_tag: string; cnt: number; avg_score: number | null }>> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('memories')
    .select('created_at, emotion_tag, emotion_score')
    .eq('elder_id', elderId)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn(`[Supabase] 情绪查询异常: ${error.message}`);
    return [];
  }

  // 客户端聚合：按天 + 情绪标签分组
  const bucket = new Map<string, { emotion_tag: string; cnt: number; sum: number }>();
  for (const row of data ?? []) {
    const day = (row.created_at as string).slice(0, 10);
    const key = `${day}|${row.emotion_tag}`;
    const prev = bucket.get(key);
    const score = typeof row.emotion_score === 'number' ? row.emotion_score : 0;
    if (prev) {
      prev.cnt++;
      prev.sum += score;
    } else {
      bucket.set(key, { emotion_tag: row.emotion_tag, cnt: 1, sum: score });
    }
  }

  return Array.from(bucket.entries()).map(([key, val]) => ({
    day: key.split('|')[0],
    emotion_tag: val.emotion_tag,
    cnt: val.cnt,
    avg_score: val.cnt > 0 ? +(val.sum / val.cnt).toFixed(2) : null,
  }));
}
