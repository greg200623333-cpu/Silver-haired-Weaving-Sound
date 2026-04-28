import { NextRequest, NextResponse } from 'next/server';
import { buildHistorianMessages } from '@/lib/prompts';
import { insertMemory, insertEntitiesAndRelations } from '@/lib/supabase';

// LLM API 配置（标准的 OpenAI 格式）
const LLM_BASE_URL = process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1';
const LLM_API_KEY = process.env.LLM_API_KEY ?? '';
const LLM_MODEL = process.env.LLM_MODEL ?? 'gpt-4o';

// JSON 解析的最大重试次数（应对 LLM 偶发的格式错误）
const MAX_PARSE_RETRIES = 2;

/**
 * POST /api/memory/process
 *
 * 接收老人语音转写文本，执行"数字史官"润色 + 时间线提取，
 * 然后存入 Supabase Memories 表。
 *
 * Body: { raw_text: string; user_id: string; voice_url?: string; duration_secs?: number }
 */
export async function POST(request: NextRequest) {
  // ---- 1. 入参校验 ----
  let body: { raw_text?: string; user_id?: string; voice_url?: string; duration_secs?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是合法 JSON' }, { status: 400 });
  }

  const { raw_text, user_id, voice_url, duration_secs } = body;

  if (!raw_text || typeof raw_text !== 'string' || raw_text.trim().length === 0) {
    return NextResponse.json({ error: 'raw_text 不能为空' }, { status: 400 });
  }

  if (!user_id || typeof user_id !== 'string') {
    return NextResponse.json({ error: 'user_id 不能为空' }, { status: 400 });
  }

  // 截断过长的输入（防止 token 超限，实际产品用 tiktoken 精确计数）
  const trimmedText = raw_text.length > 3000 ? raw_text.slice(0, 3000) + '...' : raw_text;

  console.log(`[Memory/Process] 收到请求 — user: ${user_id}, text length: ${trimmedText.length}`);

  // ---- 2. 调用 LLM（Prompt A：数字史官）----
  let llmResponse: string;
  try {
    const messages = buildHistorianMessages(trimmedText);

    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        temperature: 0.7,       // 适度创造性，保留文学色彩
        max_tokens: 800,
        response_format: { type: 'json_object' },  // 强制 JSON 输出（支持此特性的模型）
      }),
      signal: AbortSignal.timeout(30000),  // 30秒超时
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[LLM] API 返回错误:', res.status, errBody);
      return NextResponse.json(
        { error: 'AI 服务暂时不可用，请稍后再试' },
        { status: 502 }
      );
    }

    const data = await res.json();
    llmResponse = data.choices?.[0]?.message?.content ?? '';
    console.log('[LLM] 原始返回:', llmResponse.slice(0, 200));
  } catch (err: any) {
    console.error('[LLM] 请求失败:', err.message);
    return NextResponse.json(
      { error: 'AI 服务连接超时，请稍后再试' },
      { status: 504 }
    );
  }

  // ---- 3. 解析 JSON（带重试容错）----
  let parsed: {
    polished_text?: string;
    time_points?: { year: number; event: string }[];
    keywords?: string[];
    emotion?: string;
    emotion_score?: number;
    entities?: { name: string; type: string; attributes?: Record<string, string> }[];
    relations?: { subject: string; predicate: string; object: string }[];
  } = {};

  for (let attempt = 0; attempt <= MAX_PARSE_RETRIES; attempt++) {
    try {
      // 清除可能的 markdown 代码块包裹
      let cleaned = llmResponse.trim();
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');

      parsed = JSON.parse(cleaned);
      break;
    } catch {
      console.warn(`[Parse] 第 ${attempt + 1} 次解析失败，${attempt < MAX_PARSE_RETRIES ? '重试中' : '将使用降级策略'}`);

      if (attempt < MAX_PARSE_RETRIES) {
        // 重试：要求 LLM 修正格式
        const fixRes = await fetch(`${LLM_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LLM_API_KEY}`,
          },
          body: JSON.stringify({
            model: LLM_MODEL,
            messages: [
              {
                role: 'system',
                content: '你之前返回的内容不是合法 JSON。请严格按以下 JSON schema 重新输出：{"polished_text":"...","time_points":[{"year":1962,"event":"..."}],"keywords":["..."],"emotion":"怀旧"}',
              },
              { role: 'user', content: `原始输出：${llmResponse}` },
            ],
            temperature: 0,
            max_tokens: 800,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (fixRes.ok) {
          const fixData = await fixRes.json();
          llmResponse = fixData.choices?.[0]?.message?.content ?? '';
        }
      }
    }
  }

  // ---- 4. 提取字段 + 降级策略 ----
  const polishedText = parsed.polished_text ?? trimmedText;
  const timePoints = Array.isArray(parsed.time_points) ? parsed.time_points : [];
  const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
  const emotion = parsed.emotion ?? '平静';
  const emotionScore = typeof parsed.emotion_score === 'number' ? parsed.emotion_score : 0.5;
  const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
  const relations = Array.isArray(parsed.relations) ? parsed.relations : [];

  // ---- 5. 写入 Supabase ----
  let memoryId: string;
  try {
    const result = await insertMemory({
      elderId: user_id,
      voiceUrl: voice_url,
      rawText: trimmedText,
      polishedText,
      timePoints,
      keywords,
      emotion,
      emotionScore,
      durationSecs: duration_secs,
    });
    memoryId = result.id;

    // 写入知识图谱
    if (entities.length > 0) {
      const safeEntities = entities.map((e) => ({ ...e, attributes: e.attributes ?? {} }));
      await insertEntitiesAndRelations(memoryId, user_id, safeEntities, relations)
        .catch((e) => console.warn('[DB] 实体写入跳过:', e));
    }

    console.log(`[DB] 记忆已写入 — id: ${memoryId}`);
  } catch (err: any) {
    console.error('[DB] 写入失败:', err.message);
    return NextResponse.json(
      { error: '记忆存储失败，请稍后再试' },
      { status: 500 }
    );
  }

  // ---- 6. 返回结果给前端 ----
  return NextResponse.json({
    success: true,
    memory_id: memoryId,
    polished_text: polishedText,
    time_points: timePoints,
    keywords,
    emotion,
  });
}

/**
 * GET /api/memory/process — 健康检查
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    model: LLM_MODEL,
    base_url: LLM_BASE_URL.replace(/\/\/.*@/, '//***@'), // 隐藏敏感信息
  });
}
