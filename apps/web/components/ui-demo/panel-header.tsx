'use client';

import React from 'react';

type PanelHeaderProps = {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
};

export function PanelHeader({ icon, title, right }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[rgba(0,120,160,0.15)] text-base text-[#0b5e7a]">
          {icon}
        </span>
        <span className="text-xl font-medium">{title}</span>
      </div>
      {right}
    </div>
  );
}
