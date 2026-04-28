import { View } from '@tarojs/components';
import { useRef, useState, useCallback } from 'react';
import './index.css';

export interface ElderlyButtonProps {
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
  loading?: boolean;
  icon?: string;
  label?: string;
  loadingLabel?: string;
  size?: 'normal' | 'large';
  disabled?: boolean;
  ariaLabel?: string;
}

export default function ElderlyButton({
  onTouchStart,
  onTouchEnd,
  loading = false,
  icon = '🎤',
  label = '按住说话',
  loadingLabel = '正在将您的声音织成文字...',
  size = 'large',
  disabled = false,
  ariaLabel = '按住说话按钮，松手后自动上传录音',
}: ElderlyButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const lastTouchRef = useRef(0);
  const keyboardTimerRef = useRef<any>(null);

  const isLarge = size === 'large';
  const btnSize = isLarge ? 'w-elder-btn h-elder-btn' : 'w-24 h-24';
  const iconSize = isLarge ? 'text-5xl' : 'text-3xl';

  const startAction = useCallback(() => {
    if (disabled || loading) return;
    const now = Date.now();
    if (now - lastTouchRef.current < 300) return;
    lastTouchRef.current = now;
    setIsPressed(true);
    onTouchStart?.();
  }, [disabled, loading, onTouchStart]);

  const endAction = useCallback(() => {
    if (disabled || loading) return;
    if (keyboardTimerRef.current) {
      clearTimeout(keyboardTimerRef.current);
      keyboardTimerRef.current = null;
    }
    setIsPressed(false);
    onTouchEnd?.();
  }, [disabled, loading, onTouchEnd]);

  const handleKeyDown = useCallback((e: any) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startAction();
      // 键盘无"松手"概念，模拟 2 秒长按
      keyboardTimerRef.current = setTimeout(() => {
        endAction();
      }, 2000);
    }
  }, [startAction, endAction]);

  const handleKeyUp = useCallback((e: any) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      endAction();
    }
  }, [endAction]);

  const isActive = isPressed && !loading;

  // disabled 状态下显示静音图标
  const displayIcon = disabled ? '🔇' : loading ? '⏳' : icon;

  return (
    <View
      className="flex flex-col items-center justify-center gap-4"
      role="button"
      aria-label={ariaLabel}
      aria-pressed={isActive}
      aria-disabled={disabled || loading}
    >
      {/* ---- 状态播报 (屏幕阅读器) ---- */}
      <View aria-live="polite" className="sr-only">
        {loading ? loadingLabel : isActive ? '正在聆听' : label}
      </View>

      {/* ---- 主按钮 ---- */}
      <View
        className={`
          ${btnSize}
          rounded-full flex items-center justify-center
          select-none
          transition-all duration-300 ease-out
          ${disabled
            ? 'bg-gray-600 opacity-40'
            : loading
              ? 'bg-elder-gold animate-pulse'
              : isActive
                ? 'bg-elder-gold scale-90 shadow-gold-active'
                : 'bg-elder-gold breathing-light shadow-gold'
          }
        `}
        tabIndex={disabled ? -1 : 0}
        onTouchStart={startAction}
        onTouchEnd={endAction}
        onTouchCancel={endAction}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onLongPress={() => {}}
        hoverClass={disabled || loading ? '' : 'btn-hover'}
        hoverStayTime={0}
      >
        <View className={`${iconSize} ${loading ? 'animate-bounce' : ''}`}>
          {displayIcon}
        </View>
      </View>

      {/* ---- 标签文字 ---- */}
      <View className="text-elder-xl text-elder-text font-bold tracking-widest text-center">
        {loading ? loadingLabel : label}
      </View>

      {/* ---- 录音中指示 ---- */}
      {isActive && (
        <View className="flex items-center gap-2 mt-2">
          <View className="w-3 h-3 rounded-full bg-elder-danger animate-ping" />
          <View className="text-elder text-elder-muted">正在聆听...</View>
        </View>
      )}
    </View>
  );
}
