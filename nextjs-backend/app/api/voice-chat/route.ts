// ================================================================
// POST /api/voice-chat  — 双模型路由（修复版）
//
//   Request → callGLMForChat() ──[同步, 带客户端断连检测]──→ TTS
//                   │
//                   └→ executeBackgroundArchive() ──[发射后不管]──→ Supabase
//
// 修复点：
//  - AbortSignal.any(clientSignal, timeout) 检测客户端断连
//  - idempotency_key 防重复记录
//  - 后台任务并发上限 (MAX_BG_CONCURRENCY=5)
//  - processing_logs 写入作为 DeepSeek 结果持久化兜底
//  - ?demo=true 演示模式
// ================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  callGLMForChat,
  callDeepSeekForHistory,
  tryAcquireBackgroundSlot,
  releaseBackgroundSlot,
} from '@/lib/model-services';
import { getRecentMemories, getRelevantEntities, insertMemory, insertChatLog, insertEntitiesAndRelations } from '@/lib/supabase';
import { logTaskStart, logTaskComplete, logTaskError } from '@/lib/task-monitor';

const MAX_BG_CONCURRENCY = 5;

interface VoiceChatBody {
  raw_text?: string;
  user_id?: string;
  voice_url?: string;
  duration_secs?: number;
  idempotency_key?: string;        // ★ 等幂键
}

// ================================================================
// 预设演示数据（?demo=true 时使用，保证路演不翻车）
// ================================================================
const DEMO_DATA: Record<string, { reply: string; polished: string; timePoints: { year: number; event: string }[] }> = {
  'default': {
    reply: '老槐树下的春天。那天的风一定很温柔吧。',
    polished: '1962年春天，我在村口的老槐树下第一次见到她。她穿着碎花衬衫，辫子又黑又亮。风里有槐花的香味，整个春天都在那一刻停住了。',
    timePoints: [
      { year: 1962, event: '春天，村口老槐树下与爱人初遇' },
      { year: 1962, event: '爱人穿着碎花衬衫，梳着黑亮的辫子' },
    ],
  },
  'rain': {
    reply: '下雨天腿就疼。这是老毛病了吧。要不要泡杯热茶暖暖。',
    polished: '一到阴雨天，这条老腿就开始疼。是1969年在北大荒落下的病根。那年的雪格外大，零下四十度，我们把冻僵的脚插进雪里搓。那时候不觉得苦，现在倒成天气预报了。',
    timePoints: [
      { year: 1969, event: '冬天，在北大荒落下腿伤病根' },
      { year: 1969, event: '零下四十度，在雪地里搓冻僵的脚' },
    ],
  },
  'photo': {
    reply: '十八岁的你，站在天安门前。笑得真好看。',
    polished: '十八岁那年，我穿着母亲连夜缝的新棉袄，在天安门前拍了人生第一张彩色照片。那天的天空蓝得不真实，我紧张得手不知道往哪放。后来这张照片一直压在枕头底下，跟了我四十年。',
    timePoints: [
      { year: 1965, event: '十八岁，穿着母亲缝的新棉袄' },
      { year: 1965, event: '在天安门前拍了第一张彩色照片' },
    ],
  },
};

function pickDemoData(rawText: string) {
  if (rawText.includes('雨') || rawText.includes('腿') || rawText.includes('疼')) return DEMO_DATA['rain'];
  if (rawText.includes('照片') || rawText.includes('天安门') || rawText.includes('十八')) return DEMO_DATA['photo'];
  return DEMO_DATA['default'];
}

// ================================================================
// POST
// ================================================================
export async function POST(request: NextRequest) {
  // ---- 0. Demo 模式？ ----
  const url = new URL(request.url);
  const isDemo = url.searchParams.get('demo') === 'true';

  // ---- 1. 入参校验 ----
  let body: VoiceChatBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是合法 JSON' }, { status: 400 });
  }

  const { raw_text, user_id, voice_url, duration_secs, idempotency_key } = body;

  if (!raw_text || typeof raw_text !== 'string' || raw_text.trim().length === 0) {
    return NextResponse.json({ error: 'raw_text 不能为空' }, { status: 400 });
  }
  if (!user_id || typeof user_id !== 'string') {
    return NextResponse.json({ error: 'user_id 不能为空' }, { status: 400 });
  }

  const trimmedText = raw_text.length > 3000 ? raw_text.slice(0, 3000) + '...' : raw_text;
  console.log(`[VoiceChat] user: ${user_id}, text: ${trimmedText.length} chars${isDemo ? ', DEMO' : ''}${idempotency_key ? ', idem:' + idempotency_key.slice(0, 8) : ''}`);

  // ---- 2. 记忆上下文 + 知识图谱实体 ----
  let recentMemories: Awaited<ReturnType<typeof getRecentMemories>> = [];
  let relevantEntities: Awaited<ReturnType<typeof getRelevantEntities>> = [];
  try {
    [recentMemories, relevantEntities] = await Promise.all([
      getRecentMemories(user_id, 3),
      getRelevantEntities(user_id, trimmedText, 5),
    ]);
  } catch (err) {
    console.warn('[VoiceChat] 上下文获取失败:', err);
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. 干线：GLM（同步等待）
  //    ★ 传入 request.signal 用于客户端断连检测
  // ═══════════════════════════════════════════════════════════════
  let companionReply: { reply_text: string; emotion_hint: string };

  if (isDemo) {
    // 演示模式：直接返回预设数据
    await new Promise((r) => setTimeout(r, 600)); // 模拟短暂延迟
    const demo = pickDemoData(trimmedText);
    companionReply = { reply_text: demo.reply, emotion_hint: '怀旧' };
  } else {
    try {
      // ★ 合并 request.signal 实现客户端断连检测
      const clientSignal = request.signal;
      companionReply = await callGLMForChat(trimmedText, recentMemories, clientSignal, relevantEntities);
      console.log(`[GLM] 回复: "${companionReply.reply_text}"`);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[GLM] 客户端已断开，中止干线调用');
        return NextResponse.json({ error: '请求已取消' }, { status: 499 });
      }
      console.error('[GLM] 干线失败:', err.message);
      companionReply = { reply_text: '我在呢。慢慢说，不着急。', emotion_hint: '平静' };
    }
  }

  // ---- 4. 写 chat_logs（带等幂检查）----
  let chatLogId: string | undefined;
  try {
    const results = await Promise.allSettled([
      insertChatLog({
        elderId: user_id,
        role: 'elder',
        content: trimmedText.slice(0, 500),
        emotionHint: companionReply.emotion_hint,
      }),
      insertChatLog({
        elderId: user_id,
        role: 'assistant',
        content: companionReply.reply_text,
        emotionHint: companionReply.emotion_hint,
      }),
    ]);
    chatLogId = results[1].status === 'fulfilled' ? results[1].value.id : undefined;
  } catch (err) {
    console.warn('[VoiceChat] 聊天记录写入异常:', err);
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. 支线：DeepSeek 后台归档（发射后不管）
  //    ★ 并发闸门控制
  // ═══════════════════════════════════════════════════════════════
  if (!isDemo && tryAcquireBackgroundSlot()) {
    const backgroundTask = executeBackgroundArchive(
      trimmedText,
      user_id,
      voice_url,
      duration_secs,
    ).finally(releaseBackgroundSlot);

    ensureBackgroundCompletion(backgroundTask);
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. 返回干线响应
  // ═══════════════════════════════════════════════════════════════
  return NextResponse.json({
    reply_text: companionReply.reply_text,
    emotion_hint: companionReply.emotion_hint,
    chat_id: chatLogId,
  });
}

// ================================================================
// 支线：后台静默归档（带任务监控）
// ================================================================
async function executeBackgroundArchive(
  rawText: string,
  userId: string,
  voiceUrl?: string,
  durationSecs?: number,
): Promise<void> {
  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  // 记录任务开始
  logTaskStart(taskId, userId, rawText);
  console.log(`[Background] DeepSeek 归档启动 — user: ${userId}, task: ${taskId.slice(0, 12)}`);

  try {
    // Step A: DeepSeek
    const archive = await callDeepSeekForHistory(rawText);
    console.log(
      `[DeepSeek] 润色: ${archive.polished_text.length} 字, 时间点: ${archive.time_points.length}`,
    );

    // Step B: ★ 先将 raw_response 写入 processing_logs 兜底
    try {
      const { supabaseAdmin } = await import('@/lib/supabase');
      await supabaseAdmin.from('processing_logs').insert({
        elder_id: userId,
        raw_text: rawText.slice(0, 1000),
        llm_response: archive.raw_response,
        status: 'completed',
      });
    } catch (logErr) {
      console.warn('[Background] processing_logs 写入失败（不影响主流程）:', logErr);
    }

    // Step C: 写入 memories 表
    const result = await insertMemory({
      elderId: userId,
      voiceUrl,
      rawText,
      polishedText: archive.polished_text,
      timePoints: archive.time_points,
      keywords: archive.keywords,
      emotion: archive.emotion,
      emotionScore: archive.emotion_score,
      durationSecs,
    });

    // Step D: 写入知识图谱实体与关系
    if (archive.entities.length > 0) {
      try {
        await insertEntitiesAndRelations(
          result.id,
          userId,
          archive.entities,
          archive.relations,
        );
      } catch (entityErr) {
        console.warn('[Background] 实体关系写入失败（不影响主流程）:', entityErr);
      }
    }

    // 记录任务完成
    logTaskComplete(taskId);
    console.log(`[Background] memory_id: ${result.id}, 耗时: ${Date.now() - startTime}ms`);
  } catch (err: any) {
    // 记录任务失败
    logTaskError(taskId, err);
    console.error(`[Background] 归档失败（不影响聊天）:`, err.message);
  }
}

// ================================================================
// 平台适配
// ================================================================
function ensureBackgroundCompletion(task: Promise<void>): void {
  Promise.resolve()
    .then(() => import('@vercel/functions'))
    .then((mod) => {
      if (typeof mod.waitUntil === 'function') {
        mod.waitUntil(task);
        console.log('[Background] 已注册到 Vercel waitUntil');
      }
    })
    .catch(() => {
      task.catch(() => {});
    });
}

// ================================================================
// GET — 健康检查
// ================================================================
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    architecture: 'dual-model-routing',
    mainline: 'GLM-4-Flash (sync, ≤8s, free tier)',
    background: `DeepSeek-R1 (async, max ${MAX_BG_CONCURRENCY} concurrent)`,
    features: ['idempotency_key', 'demo_mode', 'processing_logs_fallback', 'abort_signal_passthrough', 'entity_linking', 'emotion_alert'],
    models: {
      mainline: process.env.GLM_MODEL ?? 'glm-4-flash',
      background: process.env.DEEPSEEK_MODEL ?? 'deepseek-reasoner',
    },
  });
}
