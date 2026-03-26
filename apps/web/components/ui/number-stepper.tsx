'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type NumberStepperProps = {
  value: number | undefined;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  loop?: boolean;
  suffix?: string;
  placeholder?: string;
  className?: string;
};

/**
 * 数値入力 + ±ステッパーボタン。
 * - キーボード直接入力対応
 * - ±ボタンで increment/decrement
 * - loop=true で max→min / min→max のループ（時刻入力用）
 * - 直接入力時は min/max でクランプ（ループしない）
 */
export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step: stepSize = 1,
  loop = false,
  suffix,
  placeholder,
  className,
}: NumberStepperProps) {
  const decrement = () => {
    const current = value ?? min;
    if (current - stepSize < min) {
      onChange(loop ? max : min);
    } else {
      onChange(current - stepSize);
    }
  };

  const increment = () => {
    const current = value ?? min;
    if (current + stepSize > max) {
      onChange(loop ? min : max);
    } else {
      onChange(current + stepSize);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      // 一時的に空にすることを許容（入力途中）
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    // 直接入力はクランプ（ループしない）
    onChange(Math.max(min, Math.min(max, Math.round(num))));
  };

  const handleBlur = () => {
    // フォーカスが外れた時点で値がなければデフォルトに
    if (value == null) {
      onChange(min);
    }
  };

  const btnClass =
    'flex h-8 w-8 items-center justify-center rounded-md border border-white/45 bg-white/10 text-white/80 hover:bg-white/20 active:bg-white/30 transition-colors select-none text-base font-medium';

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button type="button" className={btnClass} onClick={decrement} tabIndex={-1}>
        -
      </button>
      <div className="relative">
        <input
          type="number"
          className="h-8 w-16 rounded-md border border-white/45 bg-white/10 px-2 text-center text-sm text-white/90 outline-none focus:ring-2 focus:ring-white/45 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          value={value ?? ''}
          onChange={handleInputChange}
          onBlur={handleBlur}
          min={min}
          max={max}
          step={stepSize}
          placeholder={placeholder}
        />
        {suffix && value != null && (
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-white/50">
            {suffix}
          </span>
        )}
      </div>
      <button type="button" className={btnClass} onClick={increment} tabIndex={-1}>
        +
      </button>
    </div>
  );
}
