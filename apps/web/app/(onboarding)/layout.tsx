'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';
import { usePlayerProfile } from '@/lib/data/player-profile';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ready } = useAuth();
  const { data: profile, isLoading } = usePlayerProfile();

  // 完了済みユーザーはホームへ
  if (ready && !isLoading && profile?.onboarding_completed) {
    router.replace('/home');
    return null;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a1520]">
      {/* 「部屋に入る前」の暗い空間 — 壁の色味ベース */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(30,60,90,0.4)_0%,transparent_70%)]"
        aria-hidden="true"
      />
      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
}
