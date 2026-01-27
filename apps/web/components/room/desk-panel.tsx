'use client';

import { ReactNode } from 'react';

type DeskPanelProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function DeskPanel({ children, className = '', contentClassName = '' }: DeskPanelProps) {
  return (
    <section
      className={
        'min-h-[70vh] rounded-[28px] border border-white/60 bg-white/55 shadow-[0_18px_40px_rgba(6,18,32,0.18)] backdrop-blur-sm ' +
        className
      }
    >
      <div className={'px-6 py-9 ' + contentClassName}>{children}</div>
    </section>
  );
}
