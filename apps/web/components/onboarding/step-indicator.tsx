'use client';

import { cn } from '@/lib/utils';

const STEPS = ['ログイン', '同意', 'あなたの名前', '住人登録'] as const;

export function StepIndicator({ current }: { current: number }) {
  // Steps 0=login, 1=privacy, 2=name, 3&4=resident registration (shown as one segment)
  const segment = current >= 3 ? 3 : current;

  return (
    <div className="flex items-center gap-2 w-full max-w-md mx-auto">
      {STEPS.map((label, i) => (
        <div key={label} className="flex-1 flex flex-col items-center gap-1">
          <div
            className={cn(
              'h-1.5 w-full rounded-full transition-colors duration-300',
              i <= segment ? 'bg-white/80' : 'bg-white/20'
            )}
          />
          <span
            className={cn(
              'text-[10px] transition-colors duration-300',
              i <= segment ? 'text-white/80' : 'text-white/40'
            )}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
