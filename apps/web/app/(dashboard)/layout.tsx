'use client'; // フックを使うためクライアントコンポーネントに

import { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
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
  // ★ 修正: `isPending` ではなく `ready` を受け取る
  const { ready } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[16rem_1fr]">
        <Sidebar />

        {/* ★ 修正: 認証準備完了 (ready=true) の時だけ RealtimeSubscriber を描画 */}
        {ready && <RealtimeSubscriber />}

        <MotionMain>{children}</MotionMain>
      </div>

      {/* --- モーダルレイヤ（スライドイン表示） --- */}
      <DetailLayer /> {/* 会話ログ詳細（既存） */}
      <ConsultDetailLayer /> {/* 相談ログ詳細（今回追加） */}
    </div>
  );
}