'use client';

import { cn } from '@/lib/utils';

const STEPS = ['同意', 'ログイン', 'あなたの名前'] as const;

export function StepIndicator({ current }: { current: number }) {
  // Steps: 1=privacy, 2=login, 3=name → mapped to segments 0,1,2
  const segment = current - 1;

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
