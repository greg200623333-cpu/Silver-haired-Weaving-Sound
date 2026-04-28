import { View, Text } from '@tarojs/components';
import { useState, useCallback, useRef, useEffect } from 'react';
import Taro from '@tarojs/taro';
import ElderlyButton from '../../components/ElderlyButton';
import { transcribeVoice, streamVoiceChat, synthesizeSpeech } from '../../services/voice-pipeline';
import './index.css';

type PageState = 'idle' | 'recording' | 'processing' | 'done';

export default function RecordingStudio() {
  const [pageState, setPageState] = useState<PageState>('idle');
  const [polishedText, setPolishedText] = useState('');
  const [timePoints, setTimePoints] = useState<{ year: number; event: string }[]>([]);
  const [greeting, setGreeting] = useState('');
  const [lowVolumeHint, setLowVolumeHint] = useState(false);
  const [streamingReply, setStreamingReply] = useState('');
  const [voiceHint, setVoiceHint] = useState('');

  const recorderRef = useRef<Taro.RecorderManager | null>(null);
  const pageStateRef = useRef<PageState>('idle');
  // 持有当前流请求的 abort 句柄，页面卸载或状态重置时调用
  const abortChatRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    pageStateRef.current = pageState;
  }, [pageState]);

  // 问候语
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 6) setGreeting('夜深了，想起什么都可以跟我说。');
    else if (hour < 12) setGreeting('早上好呀，今天想聊点什么？');
    else if (hour < 18) setGreeting('下午好，我在听呢。');
    else setGreeting('晚上好，慢慢说，不着急。');
  }, []);

  // 重置到 idle，同时取消进行中的流请求
  const resetToIdle = useCallback((delay = 0) => {
    const doReset = () => {
      abortChatRef.current?.();
      abortChatRef.current = null;
      setPageState('idle');
      setPolishedText('');
      setTimePoints([]);
      setStreamingReply('');
      setVoiceHint('');
    };
    if (delay > 0) {
      setTimeout(doReset, delay);
    } else {
      doReset();
    }
  }, []);

  // 全链路语音处理
  const handleProcessRecording = useCallback(async (voicePath: string) => {
    setPageState('processing');
    setStreamingReply('');

    // Step 1: STT
    let rawText: string;
    try {
      setVoiceHint('正在听您说...');
      rawText = await transcribeVoice(voicePath);
      setVoiceHint('');
      if (!rawText || rawText.trim().length === 0) throw new Error('empty');
      console.log('[STT] 转写结果:', rawText.slice(0, 100));
    } catch (err) {
      setVoiceHint('');
      rawText = '我今天翻到一张老照片，想起了很多以前的事情。';
      console.log('[Demo] 使用演示模式，原因:', err);
      // 显示友好提示
      Taro.showToast({
        title: '网络不佳，使用演示模式',
        icon: 'none',
        duration: 2000
      });
    }

    // Step 2: 对话（流式 / 模拟打字）
    const { abort } = streamVoiceChat(rawText, 'demo-user-001', {
      onToken: (token) => setStreamingReply((prev) => prev + token),
      onDone: (fullText) => {
        abortChatRef.current = null;
        console.log('[Chat] 完成:', fullText);
        synthesizeSpeech(fullText);
        setPolishedText(rawText);
        setTimePoints([]);
        setPageState('done');
        resetToIdle(8000);
      },
      onError: () => {
        abortChatRef.current = null;
        console.log('[Demo] 回退演示回复');
        const demoReply = '老照片里的回忆最珍贵。那天的你一定笑得很开心吧。';
        setStreamingReply(demoReply);
        synthesizeSpeech(demoReply);
        setPolishedText(rawText);
        setTimePoints([]);
        setPageState('done');
        resetToIdle(8000);
      },
    });

    abortChatRef.current = abort;
  }, [resetToIdle]);

  // 初始化录音管理器
  useEffect(() => {
    const rm = Taro.getRecorderManager();
    recorderRef.current = rm;

    rm.onStart(() => {
      console.log('[Recorder] 开始');
      setLowVolumeHint(false);
    });

    rm.onStop((res) => {
      console.log('[Recorder] 结束:', res.duration, 'ms');
      if (pageStateRef.current === 'recording') {
        handleProcessRecording(res.tempFilePath);
      }
    });

    rm.onFrameRecorded((res) => {
      try {
        const fb = res.frameBuffer;
        if (!(fb instanceof ArrayBuffer)) return;
        const view = new Int8Array(fb);
        let sum = 0;
        for (let i = 0; i < view.length; i++) sum += Math.abs(view[i]);
        const avg = view.length > 0 ? sum / view.length : 0;
        if (avg < 8 && pageStateRef.current === 'recording') {
          setLowVolumeHint(true);
          Taro.vibrateShort({ type: 'light' }).catch(() => {});
        } else {
          setLowVolumeHint(false);
        }
      } catch {
        // 模拟器环境 frameBuffer 可能不可用
      }
    });

    rm.onError((err) => {
      console.error('[Recorder] 错误:', err);
      Taro.showToast({ title: '录音失败，请再试一次', icon: 'none', duration: 2000 });
      setPageState('idle');
    });

    return () => {
      rm.stop();
      abortChatRef.current?.();
    };
  }, [handleProcessRecording]);

  // 请求麦克风权限
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      const setting = await Taro.getSetting();
      if (setting.authSetting['scope.record'] === false) {
        setVoiceHint('需要麦克风权限才能录音，点击去设置');
        const res = await Taro.openSetting();
        return res.authSetting['scope.record'] === true;
      }
      if (setting.authSetting['scope.record'] === true) return true;
      await Taro.authorize({ scope: 'scope.record' });
      return true;
    } catch {
      setVoiceHint('需要麦克风权限才能录音，请去设置中开启');
      setTimeout(() => setVoiceHint(''), 4000);
      return false;
    }
  }, []);

  const handleTouchStart = useCallback(async () => {
    if (pageState !== 'idle') return;
    const hasPermission = await requestMicPermission();
    if (!hasPermission) return;
    setPageState('recording');
    recorderRef.current?.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3',
      frameSize: 10,
    });
  }, [pageState, requestMicPermission]);

  const handleTouchEnd = useCallback(() => {
    if (pageState !== 'recording') return;
    setPageState('processing');
    recorderRef.current?.stop();
  }, [pageState]);

  return (
    <View className="min-h-screen bg-elder-bg flex flex-col items-center justify-between px-6 py-12">
      {/* 标题 */}
      <View className="flex flex-col items-center mt-8">
        <Text className="text-elder-xl text-elder-text font-bold mb-2">回忆录音室</Text>
        <Text className="text-elder text-elder-muted text-center leading-relaxed">{greeting}</Text>
      </View>

      {/* 主区域 */}
      <View className="flex-1 flex flex-col items-center justify-center w-full">
        <View aria-live="assertive" className="sr-only">
          {pageState === 'recording' ? '正在录音' :
           pageState === 'processing' ? '正在处理您的语音' :
           pageState === 'done' ? '回忆已整理完成' : ''}
        </View>

        {pageState === 'done' ? (
          <DoneCard text={polishedText} timePoints={timePoints} />
        ) : (
          <ElderlyButton
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            loading={pageState === 'processing'}
            disabled={pageState !== 'idle' && pageState !== 'recording'}
            icon={pageState === 'recording' ? '●' : '♪'}
            label={
              pageState === 'processing'
                ? ''
                : pageState === 'recording'
                  ? '正在听您说...'
                  : '按住说话'
            }
            loadingLabel="正在将您的声音织成文字..."
          />
        )}

        {/* SSE 流式回复实时展示 */}
        {pageState === 'processing' && streamingReply && (
          <View className="mt-4 px-6 py-4 bg-elder-surface rounded-2xl max-w-md mx-auto animate-fade-in">
            <Text className="text-elder text-elder-text leading-relaxed">
              {streamingReply}
              <Text className="text-elder-gold animate-pulse">|</Text>
            </Text>
          </View>
        )}

        {/* 语音状态提示 */}
        {voiceHint && (
          <View className="mt-4 animate-fade-in">
            <View className="px-6 py-4 bg-elder-surface rounded-2xl">
              <Text className="text-elder text-elder-muted text-center">{voiceHint}</Text>
            </View>
          </View>
        )}

        {/* 音量过低提示 */}
        {lowVolumeHint && pageState === 'recording' && (
          <View className="mt-4 animate-fade-in">
            <Text className="text-elder-gold text-elder font-bold">大声点，我在听呢</Text>
          </View>
        )}
      </View>

      {/* 底部状态栏 */}
      <View className="mb-6">
        {pageState === 'idle' && (
          <View className="flex items-center gap-2">
            <View className="w-2 h-2 rounded-full bg-elder-success breathing-dot" />
            <Text className="text-base text-elder-muted">松开即自动上传</Text>
          </View>
        )}
        {pageState === 'recording' && (
          <View className="flex items-center gap-2">
            <View className="w-3 h-3 rounded-full bg-elder-danger animate-pulse" />
            <Text className="text-lg text-elder-gold font-bold">录音中</Text>
          </View>
        )}
        {pageState === 'processing' && (
          <View className="flex items-center gap-2">
            <View className="w-2 h-2 rounded-full bg-elder-gold animate-pulse" />
            <Text className="text-base text-elder-muted">正在整理您的回忆...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function DoneCard({
  text,
  timePoints,
}: {
  text: string;
  timePoints: { year: number; event: string }[];
}) {
  return (
    <View className="w-full max-w-lg mx-auto animate-fade-in">
      <View className="bg-elder-surface rounded-3xl p-6 mb-4 shadow-lg">
        <Text className="text-elder text-elder-text leading-loose tracking-wide">{text}</Text>
      </View>

      {timePoints.length > 0 && (
        <View className="bg-elder-surface rounded-3xl p-4 mb-4">
          <View className="flex items-center gap-2 mb-2">
            <View className="w-2 h-2 rounded-full bg-elder-gold" />
            <Text className="text-base text-elder-gold font-bold">时间线</Text>
          </View>
          {timePoints.slice(0, 3).map((tp, i) => (
            <View key={i} className="flex gap-2 mb-1">
              <Text className="text-elder-gold font-bold w-14">{tp.year}</Text>
              <Text className="text-elder-text">{tp.event}</Text>
            </View>
          ))}
        </View>
      )}

      <View className="flex justify-center mt-2">
        <View className="countdown-circle">
          <View className="countdown-circle__inner" />
        </View>
      </View>
    </View>
  );
}
