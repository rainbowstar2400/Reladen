'use client'; // フックを使うためクライアントコンポーネントに

import { ReactNode } from 'react';
import { Header } from '@/components/layout/header';
import { MotionMain } from '@/components/layout/motion-main';
import { RoomStage } from '@/components/room/room-stage';
import DetailLayer from '@/components/logs/detail-layer';
import ConsultDetailLayer from '@/components/consults/detail-layer';
import RealtimeSubscriber from '@/components/Realtime/RealtimeSubscriber';
import { useAuth } from '@/lib/auth/use-auth'; // useAuth をインポート
import { usePathname } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // `ready` に加えて `user` も取得
  const { ready, user } = useAuth();
  const pathname = usePathname();
  const isRoomRoute = pathname === '/home' || pathname === '/office' || pathname === '/reports';
  const activeFace = pathname === '/office' ? 'right' : pathname === '/reports' ? 'left' : 'front';

  return (
    <div className="flex min-h-screen flex-col">
      {!isRoomRoute && <Header />}
      <div className="flex-1">
        {/* 準備完了(ready) かつ ユーザーが存在する(user) の時だけ描画 */}
        {ready && user && <RealtimeSubscriber />}
        {isRoomRoute ? (
          <RoomStage activeFace={activeFace}>{children}</RoomStage>
        ) : (
          <MotionMain>{children}</MotionMain>
        )}
      </div>

      {/* --- モーダルレイヤ（スライドイン表示） --- */}
      <DetailLayer /> {/* 会話ログ詳細（既存） */}
      <ConsultDetailLayer /> {/* 相談ログ詳細（今回追加） */}
    </div>
  );
}
