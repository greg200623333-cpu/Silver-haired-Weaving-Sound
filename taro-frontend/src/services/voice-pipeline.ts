// ================================================================
// 全链路语音管线：STT → LLM → TTS
// STT: 有道语音识别（上传音频到后端）
// TTS: 有道语音合成（后端代理）
// weapp: 使用 Taro.request 非流式接口 + 客户端模拟打字效果
// h5:   使用 fetch + SSE 流式接口
// ================================================================

import Taro from '@tarojs/taro';

// 开发环境使用阿里云后端（必须 HTTPS）
const API_BASE = 'https://nrs.greg.asia';

const IS_WEAPP = process.env.TARO_ENV === 'weapp';

// ---- 离线队列机制 ----
const QUEUE_KEY = 'pending_recordings';
const NETWORK_LISTENER_REGISTERED_KEY = 'network_listener_registered';

interface QueuedRecording {
  rawText: string;
  userId: string;
  timestamp: number;
  voicePath?: string;
}

// 入队录音数据
export function enqueueRecording(rawText: string, userId: string, voicePath?: string): void {
  try {
    const queue = Taro.getStorageSync(QUEUE_KEY) || [];
    queue.push({ rawText, userId, timestamp: Date.now(), voicePath });
    Taro.setStorageSync(QUEUE_KEY, queue);
    console.log('[离线队列] 已入队，当前队列长度:', queue.length);
  } catch (err) {
    console.error('[离线队列] 入队失败:', err);
  }
}

// 处理队列（网络恢复后自动调用）
export async function processQueue(): Promise<void> {
  try {
    const queue: QueuedRecording[] = Taro.getStorageSync(QUEUE_KEY) || [];
    if (queue.length === 0) return;

    console.log('[离线队列] 开始处理，队列长度:', queue.length);

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      try {
        // 尝试上传
        await Taro.request({
          url: `${API_BASE}/api/voice-chat`,
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          data: { raw_text: item.rawText, user_id: item.userId },
        });

        console.log('[离线队列] 成功上传第', i + 1, '条');
        // 成功后从队列移除
        queue.shift();
        Taro.setStorageSync(QUEUE_KEY, queue);
      } catch (err) {
        console.error('[离线队列] 上传失败，停止处理:', err);
        break; // 失败则停止，下次重试
      }
    }

    console.log('[离线队列] 处理完成，剩余:', queue.length);
  } catch (err) {
    console.error('[离线队列] 处理队列失败:', err);
  }
}

// 注册网络状态监听器（仅注册一次）
export function registerNetworkListener(): void {
  try {
    const registered = Taro.getStorageSync(NETWORK_LISTENER_REGISTERED_KEY);
    if (registered) return;

    Taro.onNetworkStatusChange((res) => {
      console.log('[网络监听] 网络状态变化:', res.isConnected, res.networkType);
      if (res.isConnected) {
        console.log('[网络监听] 网络已恢复，开始处理离线队列');
        processQueue();
      }
    });

    Taro.setStorageSync(NETWORK_LISTENER_REGISTERED_KEY, true);
    console.log('[网络监听] 监听器已注册');
  } catch (err) {
    console.error('[网络监听] 注册失败:', err);
  }
}

// 获取队列长度（用于 UI 显示）
export function getQueueLength(): number {
  try {
    const queue = Taro.getStorageSync(QUEUE_KEY) || [];
    return queue.length;
  } catch {
    return 0;
  }
}

// ---- 语音转写 (STT) ----
export async function transcribeVoice(voicePath: string): Promise<string> {
  console.log('[STT] 开始上传音频:', voicePath);

  const result = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      console.error('[STT] 请求超时 (60s)');
      reject(new Error('timeout'));
    }, 60000); // 增加到 60 秒

    Taro.uploadFile({
      url: `${API_BASE}/api/stt/transcribe`,
      filePath: voicePath,
      name: 'audio',
      success(res) {
        clearTimeout(timer);
        console.log('[STT] 服务器响应:', res.statusCode, res.data);
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
        console.error('[STT] 上传失败:', err);
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
    });

    const data = res.data as any;

    // 如果后端返回音频 URL，直接播放
    if (data.audioUrl) {
      const audioCtx = Taro.createInnerAudioContext();
      audioCtx.src = data.audioUrl;
      audioCtx.autoplay = true;
      audioCtx.play();
      console.log('[TTS] 播放 URL:', data.audioUrl);
      return;
    }

    // 否则处理 ArrayBuffer（暂时跳过，因为有解码问题）
    console.warn('[TTS] 未获取到音频 URL，跳过播放');
  } catch (err) {
    console.error('[TTS] 播放失败:', err);
  }
}
