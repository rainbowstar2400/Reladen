'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type GlassPanelProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function GlassPanel({ children, className, contentClassName }: GlassPanelProps) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border border-white/60 bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-8px_20px_rgba(4,18,30,0.14),0_8px_16px_rgba(4,18,30,0.18),0_26px_42px_rgba(4,18,30,0.22)] backdrop-blur-[18px] saturate-125',
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(115deg,rgba(255,255,255,0.6),rgba(255,255,255,0.22)_32%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.18))] opacity-55"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(rgba(255,255,255,0.2)_0.6px,transparent_0.6px)] bg-[length:6px_6px] opacity-20 mix-blend-soft-light"
        aria-hidden="true"
      />
      <div className={cn('relative z-10', contentClassName)}>{children}</div>
    </div>
  );
}
