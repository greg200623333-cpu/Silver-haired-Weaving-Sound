// ================================================================
// 全链路语音管线：STT → LLM → TTS
// STT: 有道语音识别（上传音频到后端）
// TTS: 有道语音合成（后端代理）
// weapp: 使用 Taro.request 非流式接口 + 客户端模拟打字效果
// h5:   使用 fetch + SSE 流式接口
// ================================================================

import Taro from '@tarojs/taro';

// 开发环境使用阿里云后端
const API_BASE = 'http://nrs.greg.asia';

const IS_WEAPP = process.env.TARO_ENV === 'weapp';

// ---- 语音转写 (STT) ----
export async function transcribeVoice(voicePath: string): Promise<string> {
  const result = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 30000); // 增加到 30 秒

    Taro.uploadFile({
      url: `${API_BASE}/api/stt/transcribe`,
      filePath: voicePath,
      name: 'audio',
      success(res) {
        clearTimeout(timer);
        try {
          const data = JSON.parse(res.data as string);
          if (data.text) {
            resolve(data.text);
          } else {
            reject(new Error(data.error || '未识别出文字'));
          }
        } catch {
          reject(new Error('响应解析失败'));
        }
      },
      fail(err) {
        clearTimeout(timer);
        reject(new Error(String(err?.errMsg ?? '上传失败')));
      },
    });
  });

  return result;
}

// ---- SSE 流式对话 ----
export interface SSEStreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string, emotion: string) => void;
  onError: (message: string) => void;
}

export function streamVoiceChat(
  rawText: string,
  userId: string,
  callbacks: SSEStreamCallbacks,
  signal?: AbortSignal,
): { abort: () => void } {
  let aborted = false;

  const abort = () => {
    aborted = true;
  };

  if (signal) {
    signal.addEventListener('abort', abort, { once: true });
  }

  if (IS_WEAPP) {
    // weapp: 使用非流式接口，客户端模拟逐字输出
    _weappChat(rawText, userId, callbacks, () => aborted);
  } else {
    // h5: fetch + SSE
    _h5StreamChat(rawText, userId, callbacks, () => aborted);
  }

  return { abort };
}

// ----------------------------------------------------------------
// weapp 路径：Taro.request → 非流式接口 → 模拟打字效果
// ----------------------------------------------------------------
function _weappChat(
  rawText: string,
  userId: string,
  callbacks: SSEStreamCallbacks,
  isAborted: () => boolean,
) {
  Taro.request({
    url: `${API_BASE}/api/voice-chat`,
    method: 'POST',
    header: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ raw_text: rawText, user_id: userId }),
    success(res: any) {
      if (isAborted()) return;
      const data = res.data as { reply_text?: string; emotion_hint?: string; error?: string };
      if (!data?.reply_text) {
        callbacks.onError(data?.error ?? 'AI 服务暂时不可用');
        return;
      }
      // 模拟逐字 token 输出（每 40ms 一个字）
      const text = data.reply_text;
      const emotion = data.emotion_hint ?? '平静';
      let i = 0;
      const tick = setInterval(() => {
        if (isAborted()) {
          clearInterval(tick);
          return;
        }
        if (i < text.length) {
          callbacks.onToken(text[i]);
          i++;
        } else {
          clearInterval(tick);
          callbacks.onDone(text, emotion);
        }
      }, 40);
    },
    fail(err: any) {
      if (isAborted()) return;
      callbacks.onError(err?.errMsg ?? '网络异常');
    },
  });
}

// ----------------------------------------------------------------
// H5 路径：fetch + SSE（标准多行格式 event:\ndata:\n\n）
// ----------------------------------------------------------------
function _h5StreamChat(
  rawText: string,
  userId: string,
  callbacks: SSEStreamCallbacks,
  isAborted: () => boolean,
) {
  const controller = new AbortController();

  // 包装 isAborted 以支持外部 abort 调用
  const originalIsAborted = isAborted;
  const wrappedIsAborted = () => {
    if (originalIsAborted()) {
      controller.abort();
      return true;
    }
    return controller.signal.aborted;
  };

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/voice-chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: rawText, user_id: userId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        callbacks.onError('AI 服务暂时不可用');
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        callbacks.onError('不支持流式响应');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let pendingEvent = '';

      while (true) {
        if (wrappedIsAborted()) break;

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trimEnd();
          if (trimmed.startsWith('event: ')) {
            // 标准 SSE：event 行在 data 行之前
            pendingEvent = trimmed.slice(7).trim();
          } else if (trimmed.startsWith('data: ')) {
            const payload = trimmed.slice(6);
            if (payload === '[DONE]') {
              if (fullText) callbacks.onDone(fullText, '平静');
              return;
            }
            try {
              const parsed = JSON.parse(payload) as { text?: string; message?: string; emotion?: string };
              const evt = pendingEvent;
              pendingEvent = '';

              if (evt === 'token' && parsed.text) {
                fullText += parsed.text;
                callbacks.onToken(parsed.text);
              } else if (evt === 'done') {
                callbacks.onDone(fullText || parsed.text || '', parsed.emotion ?? '平静');
                return;
              } else if (evt === 'error') {
                callbacks.onError(parsed.message ?? '未知错误');
                return;
              }
            } catch {
              // 跳过非 JSON 行
            }
          } else if (trimmed === '') {
            // 空行 = SSE 事件分隔符，重置 pending
            pendingEvent = '';
          }
        }
      }

      if (fullText) callbacks.onDone(fullText, '平静');
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      callbacks.onError(err?.message ?? '网络异常');
    }
  })();
}

// ---- 语音合成 (TTS) ----
export async function synthesizeSpeech(text: string): Promise<void> {
  try {
    const res = await Taro.request({
      url: `${API_BASE}/api/tts/synthesize`,
      method: 'POST',
      data: { text, speed: 0.9 },
      responseType: 'arraybuffer',
    });

    const arrayBuffer = res.data as ArrayBuffer;

    if (IS_WEAPP) {
      const audioCtx = Taro.createInnerAudioContext();
      const fs = Taro.getFileSystemManager();
      // 使用 Taro.env 而非直接访问 wx.env
      const userDataPath = (Taro as any).env?.USER_DATA_PATH ?? '';
      const filePath = `${userDataPath}/tts_${Date.now()}.mp3`;

      fs.writeFile({
        filePath,
        data: arrayBuffer,
        success() {
          audioCtx.src = filePath;
          audioCtx.autoplay = true;
          audioCtx.play();
          console.log('[TTS] 播放中:', text.slice(0, 30));
        },
        fail(err) {
          console.error('[TTS] 写文件失败:', err);
        },
      });
      return;
    }

    // H5 端
    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
    console.log('[TTS] 播放中:', text.slice(0, 30));
  } catch (err) {
    console.error('[TTS] 播放失败:', err);
  }
}
