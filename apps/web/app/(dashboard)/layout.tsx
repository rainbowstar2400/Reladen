'use client'; // フックを使うためクライアントコンポーネントに

import { ReactNode } from 'react';
import { Header } from '@/components/layout/header';
import { MotionMain } from '@/components/layout/motion-main';
import DetailLayer from '@/components/logs/detail-layer';
import ConsultDetailLayer from '@/components/consults/detail-layer';
import RealtimeSubscriber from '@/components/Realtime/RealtimeSubscriber';
import { useAuth } from '@/lib/auth/use-auth'; // useAuth をインポート

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // `ready` に加えて `user` も取得
  const { ready, user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1">
        {/* 準備完了(ready) かつ ユーザーが存在する(user) の時だけ描画 */}
        {ready && user && <RealtimeSubscriber />}

        <MotionMain>{children}</MotionMain>
      </div>

      {/* --- モーダルレイヤ（スライドイン表示） --- */}
      <DetailLayer /> {/* 会話ログ詳細（既存） */}
      <ConsultDetailLayer /> {/* 相談ログ詳細（今回追加） */}
    </div>
  );
}
