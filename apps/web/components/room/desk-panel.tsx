'use client';

import { ReactNode } from 'react';
import { useDeskPanelContentVisible } from '@/components/room/desk-panel-context';

type DeskPanelProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function DeskPanel({ children, className = '', contentClassName = '' }: DeskPanelProps) {
  const contentVisible = useDeskPanelContentVisible();
  const visibilityClass = contentVisible ? 'opacity-100' : 'opacity-0';

  return (
    <section
      className={
        'min-h-[70vh] h-[min(78vh,860px)] overflow-hidden rounded-[28px] border border-white/35 bg-white/12 text-white/90 shadow-[0_18px_40px_rgba(6,18,32,0.22)] backdrop-blur-md ' +
        '[&_.text-muted-foreground]:text-white/60 [&_.text-foreground]:text-white/90 [&_.text-card-foreground]:text-white/90 ' +
        '[&_.text-gray-700]:text-white/70 [&_.text-gray-600]:text-white/60 [&_.text-gray-500]:text-white/60 [&_.text-gray-400]:text-white/50 ' +
        className
      }
    >
      <div
        className={
          'h-full overflow-y-auto px-6 py-9 transition-opacity duration-200 ' +
          visibilityClass +
          ' ' +
          contentClassName
        }
      >
        {children}
      </div>
    </section>
  );
}
