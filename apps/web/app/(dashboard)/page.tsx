// （先頭に 'use client' を付けないこと！＝サーバーのまま）
import { redirect } from 'next/navigation';
import RealtimeSubscriber from '@/components/Realtime/RealtimeSubscriber';

// 必要ならサーバー側の前処理（セッション検査等）を行い、条件により redirect する
export default async function DashboardPage() {
  // 例:
  // const session = await auth();
  // if (!session) redirect('/login');

  return (
    <div className="container mx-auto max-w-[1200px] px-4 py-6">
      {/* Realtime購読（見えないコンポーネント） */}
      <RealtimeSubscriber />

      {/* 既存のダッシュボードUI... */}
      {/* <NotificationsPanel /> など */}
    </div>
  );
}
