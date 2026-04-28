// ================================================================
// POST /api/voice-chat/stream  — SSE 流式干线（GLM-4-Flash）
//
// Server-Sent Events 逐 token 推送 AI 回复，前端实时展示。
// GLM-4-Flash API 完全兼容 OpenAI 格式，支持 stream=true。
// ================================================================

import { NextRequest } from 'next/server';
import { PROMPT_COMPANION } from '@/lib/prompts';
import { getRecentMemories, getRelevantEntities } from '@/lib/supabase';

const GLM_BASE_URL = process.env.GLM_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4';
const GLM_API_KEY = process.env.GLM_API_KEY ?? '';
const GLM_MODEL = process.env.GLM_MODEL ?? 'glm-4-flash';

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

export async function POST(request: NextRequest) {
  let body: { raw_text?: string; user_id?: string; voice_url?: string; duration_secs?: number; idempotency_key?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: '请求体必须是合法 JSON' }), { status: 400 });
  }

  const { raw_text, user_id } = body;
  if (!raw_text || !user_id) {
    return new Response(JSON.stringify({ error: 'raw_text 和 user_id 不能为空' }), { status: 400 });
  }

  const trimmedText = raw_text.length > 3000 ? raw_text.slice(0, 3000) + '...' : raw_text;

  let [recentMemories, relevantEntities] = [[], []] as [any[], any[]];
  try {
    [recentMemories, relevantEntities] = await Promise.all([
      getRecentMemories(user_id, 3),
      getRelevantEntities(user_id, trimmedText, 5),
    ]);
  } catch { /* ignore */ }

  const contextText = recentMemories.slice(0, 3).map((m: any) => m.polished_text?.slice(0, 100)).filter(Boolean).join('；');
  const entityText = buildEntitySnippet(relevantEntities);

  let userContent = `老人说："${trimmedText}"`;
  const parts: string[] = [];
  if (contextText) parts.push(`老人之前的记忆：\n${contextText}`);
  if (entityText) parts.push(`老人人生中重要的人和地方：\n${entityText}`);
  if (parts.length > 0) userContent = `${parts.join('\n\n')}\n\n现在老人说："${trimmedText}"`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };

      try {
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
            stream: true,
          }),
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(12000)]),
        });

        if (!res.ok) {
          enqueue('error', JSON.stringify({ message: 'AI 服务暂时不可用' }));
          controller.close();
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          enqueue('done', JSON.stringify({ text: '嗯，我在听呢。', emotion: '平静' }));
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;

            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                enqueue('token', JSON.stringify({ text: delta }));
              }
            } catch {
              // 非 JSON 行，跳过
            }
          }
        }

        enqueue('done', JSON.stringify({
          text: fullText.slice(0, 50) || '嗯，我在听呢。',
          emotion: guessEmotion(fullText),
        }));
      } catch (err: any) {
        if (err.name === 'AbortError') {
          enqueue('error', JSON.stringify({ message: '请求超时或已取消' }));
        } else {
          enqueue('error', JSON.stringify({ message: '网络异常' }));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function guessEmotion(text: string): string {
  const lower = text.toLowerCase();
  if (/开心|真好|太棒|幸福|快乐/.test(lower)) return '喜悦';
  if (/难过|伤心|疼|走不动|老了/.test(lower)) return '感伤';
  if (/以前|那时候|记得|当年|年轻/.test(lower)) return '怀旧';
  if (/想|念|惦记|牵挂/.test(lower)) return '思念';
  return '平静';
}
