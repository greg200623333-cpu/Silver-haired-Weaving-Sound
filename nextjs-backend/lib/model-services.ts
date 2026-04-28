// ================================================================
// 银发织音 — 双模型服务层
// callGLMForChat()        → 干线：GLM-4-Flash 低延迟温情回复（免费）
// callDeepSeekForHistory() → 支线：DeepSeek-R1 静默润色 + 知识图谱
// ================================================================

import { PROMPT_COMPANION, PROMPT_HISTORIAN } from './prompts';

// ---- 类型 ----

export interface CompanionReply {
  reply_text: string;
  emotion_hint: string;
}

export interface HistoryArchive {
  polished_text: string;
  time_points: { year: number; event: string }[];
  keywords: string[];
  emotion: string;
  emotion_score: number;
  entities: Array<{ type: string; name: string; attributes: Record<string, string> }>;
  relations: Array<{ subject: string; predicate: string; object: string }>;
  raw_response: string;
}

// ---- 模型 API 配置 ----
// 干线：智谱 GLM-4-Flash（免费，情感陪伴场景优化）
const GLM_BASE_URL = process.env.GLM_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4';
const GLM_API_KEY = process.env.GLM_API_KEY ?? '';
const GLM_MODEL = process.env.GLM_MODEL ?? 'glm-4-flash';

// 支线：DeepSeek-R1（JSON 结构化最稳）
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-reasoner';

const MAX_PARSE_RETRIES = 2;

// ---- 并发上限 ----
let backgroundConcurrency = 0;
const MAX_BACKGROUND_CONCURRENCY = 5;

export function tryAcquireBackgroundSlot(): boolean {
  if (backgroundConcurrency >= MAX_BACKGROUND_CONCURRENCY) {
    console.warn(`[Background] 并发已达上限 ${MAX_BACKGROUND_CONCURRENCY}，跳过本次归档`);
    return false;
  }
  backgroundConcurrency++;
  return true;
}

export function releaseBackgroundSlot(): void {
  backgroundConcurrency = Math.max(0, backgroundConcurrency - 1);
}

// ---- 工具 ----

function buildContextSnippet(memories: Array<{ polished_text?: string; keywords?: string[] }>): string {
  if (!memories || memories.length === 0) return '';
  const parts = memories
    .filter((m) => m.polished_text)
    .slice(0, 3)
    .map((m) => m.polished_text!.slice(0, 100));
  if (parts.length === 0) return '';
  return parts.join('；');
}

function buildEntitySnippet(entities: Array<{ name: string; type: string; attributes: Record<string, any> }>): string {
  if (!entities || entities.length === 0) return '';
  return entities
    .map((e) => {
      const attrs = Object.entries(e.attributes ?? {})
        .map(([k, v]) => `${k}:${v}`)
        .join(', ');
      return `- ${e.name}（${e.type}${attrs ? ', ' + attrs : ''}）`;
    })
    .join('\n');
}

// ================================================================
// 干线：GLM-4-Flash 温情陪伴
// 智谱 API 完全兼容 OpenAI 格式，temperature=0.9 保持温暖多变
// 支持外部 AbortSignal（用于检测客户端断开）
// ================================================================
export async function callGLMForChat(
  rawText: string,
  recentMemories?: Array<{ polished_text?: string; keywords?: string[] }>,
  externalSignal?: AbortSignal,
  entityContext?: Array<{ name: string; type: string; attributes: Record<string, any> }>,
): Promise<CompanionReply> {
  const contextText = buildContextSnippet(recentMemories ?? []);
  const entityText = buildEntitySnippet(entityContext ?? []);

  let userContent = `老人说："${rawText}"`;
  const parts: string[] = [];
  if (contextText) parts.push(`以下是老人之前讲过的记忆（供你参考，不要复述全部）：\n${contextText}`);
  if (entityText) parts.push(`以下是老人人生中的重要人物和地点（如果当前对话涉及，可以自然提及）：\n${entityText}`);
  if (parts.length > 0) {
    userContent = `${parts.join('\n\n')}\n\n现在老人说："${rawText}"`;
  }

  const combinedSignal = externalSignal
    ? AbortSignal.any([externalSignal, AbortSignal.timeout(8000)])
    : AbortSignal.timeout(8000);

  const res = await fetch(`${GLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: GLM_MODEL,
      messages: [
        { role: 'system', content: PROMPT_COMPANION },
        { role: 'user', content: userContent },
      ],
      temperature: 0.9,
      max_tokens: 120,
      stream: false,
    }),
    signal: combinedSignal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`GLM API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const replyText = data.choices?.[0]?.message?.content?.trim() ?? '嗯，我在听呢。';

  return {
    reply_text: replyText.slice(0, 50),
    emotion_hint: guessEmotion(replyText),
  };
}

// ================================================================
// 支线：DeepSeek-R1 静默档案整理
// R1 的推理链在 JSON 结构化提取上远优于 V3，45s 超时足够
// ================================================================
export async function callDeepSeekForHistory(rawText: string): Promise<HistoryArchive> {
  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: PROMPT_HISTORIAN },
        { role: 'user', content: `以下是老人的口语转写文字：\n\n${rawText}` },
      ],
      temperature: 0.5,
      max_tokens: 2000,
      stream: false,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`DeepSeek API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  let rawContent: string = data.choices?.[0]?.message?.content ?? '';

  // R1 的思考内容在 reasoning_content 字段，输出在 content
  // 如果 content 为空（偶发），回退到整个 message 的字符串表示
  if (!rawContent.trim()) {
    rawContent = JSON.stringify(data.choices?.[0]?.message ?? {}) || '{}';
  }

  const parsed = await parseHistorianWithRetry(rawContent, rawText);

  return { ...parsed, raw_response: rawContent };
}

// ---- 辅助 ----

function guessEmotion(text: string): string {
  const lower = text.toLowerCase();
  if (/开心|真好|太棒|幸福|快乐/.test(lower)) return '喜悦';
  if (/难过|伤心|疼|走不动|老了/.test(lower)) return '感伤';
  if (/以前|那时候|记得|当年|年轻/.test(lower)) return '怀旧';
  if (/想|念|惦记|牵挂/.test(lower)) return '思念';
  return '平静';
}

async function parseHistorianWithRetry(
  raw: string,
  fallbackText: string,
): Promise<Omit<HistoryArchive, 'raw_response'>> {
  for (let attempt = 0; attempt <= MAX_PARSE_RETRIES; attempt++) {
    try {
      let cleaned = raw.trim();
      // R1 有时会在 JSON 外包裹推理文字，取最后一个合法 JSON 块
      const jsonMatches = cleaned.match(/\{[\s\S]*\}/g);
      if (jsonMatches) cleaned = jsonMatches[jsonMatches.length - 1];
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned);

      return {
        polished_text: parsed.polished_text ?? fallbackText.slice(0, 200),
        time_points: Array.isArray(parsed.time_points) ? parsed.time_points : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        emotion: parsed.emotion ?? '平静',
        emotion_score: typeof parsed.emotion_score === 'number' ? parsed.emotion_score : 0.5,
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        relations: Array.isArray(parsed.relations) ? parsed.relations : [],
      };
    } catch {
      console.warn(`[DeepSeek] JSON 解析失败 (attempt ${attempt + 1}/${MAX_PARSE_RETRIES + 1})`);

      if (attempt < MAX_PARSE_RETRIES) {
        try {
          const fixRes = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
              model: DEEPSEEK_MODEL,
              messages: [
                {
                  role: 'system',
                  content:
                    '你之前的输出不是合法 JSON。请严格按照以下 JSON schema 重新输出：{"polished_text":"...","time_points":[{"year":1962,"event":"..."}],"keywords":["..."],"emotion":"怀旧","emotion_score":0.85,"entities":[],"relations":[]}',
                },
                { role: 'user', content: `原始输出：${raw.slice(0, 500)}` },
              ],
              temperature: 0,
              max_tokens: 1000,
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (fixRes.ok) {
            const fixData = await fixRes.json();
            raw = fixData.choices?.[0]?.message?.content ?? '';
          }
        } catch {
          console.warn('[DeepSeek] JSON 修复请求失败，继续下一轮');
        }
      }
    }
  }

  console.error('[DeepSeek] JSON 解析全部重试失败，使用降级数据');
  return {
    polished_text: fallbackText.slice(0, 200),
    time_points: [],
    keywords: [],
    emotion: '平静',
    emotion_score: 0.5,
    entities: [],
    relations: [],
  };
}
