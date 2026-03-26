'use client';

import { ReactNode, useCallback, useState } from 'react';
import { Header } from '@/components/layout/header';
import { MotionMain } from '@/components/layout/motion-main';
import { RoomStage } from '@/components/room/room-stage';
import DetailLayer from '@/components/logs/detail-layer';
import ConsultDetailLayer from '@/components/consults/detail-layer';
import RealtimeSubscriber from '@/components/Realtime/RealtimeSubscriber';
import { useAuth } from '@/lib/auth/use-auth';
import { usePathname } from 'next/navigation';
import { usePlayerProfile } from '@/lib/data/player-profile';

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { ready, user } = useAuth();
  const { data: profile, isLoading: profileLoading } = usePlayerProfile();
  const pathname = usePathname();

  // カーテンが exit アニメーション中でもコンテンツを見せるためのフラグ
  const [curtainDismissed, setCurtainDismissed] = useState(false);

  const handleCurtainComplete = useCallback(() => {
    setCurtainDismissed(true);
  }, []);

  // 状態未確定 → カーテンと同色の背景（フラッシュ防止）
  if (!ready || profileLoading) {
    return <div className="min-h-screen bg-[#0d2136]" />;
  }

  const showCurtain = !curtainDismissed && (!profile || !profile.onboarding_completed);

  const isHomeRoute = pathname === '/home';
  const isReportRoute = pathname === '/reports';
  const isOfficeRoute =
    pathname.startsWith('/office') ||
    ['/settings', '/playguide', '/specs', '/legal', '/contact'].some((p) => pathname.startsWith(p));
  const isRoomRoute = isHomeRoute || isReportRoute || isOfficeRoute;
  const activeFace = isReportRoute ? 'left' : isOfficeRoute ? 'right' : 'front';

  return (
    <div className="flex min-h-screen flex-col">
      {!isRoomRoute && <Header />}
      <div className="flex-1">
        {ready && user && <RealtimeSubscriber />}
        {isRoomRoute ? (
          <RoomStage
            activeFace={activeFace}
            showCurtain={showCurtain}
            onCurtainComplete={handleCurtainComplete}
          >
            {children}
          </RoomStage>
        ) : (
          <MotionMain>{children}</MotionMain>
        )}
      </div>

      <DetailLayer />
      <ConsultDetailLayer />
    </div>
  );
}
