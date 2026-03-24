'use client';

import { ReactNode } from 'react';
import skyImage from '@/app/ui-demo/pre_sky.jpg';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#a5b7c8]">
      {/* 空背景（ホーム画面と同じ） */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${skyImage.src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
}
