'use client'; // フックを使うためクライアントコンポーネントに

import {
  ReactNode,
  useState,
  useMemo,
  useContext,
  useEffect,
  createContext,
  useRef,
} from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MotionMain } from '@/components/layout/motion-main';
import DetailLayer from '@/components/logs/detail-layer';
import ConsultDetailLayer from '@/components/consults/detail-layer';
import RealtimeSubscriber from '@/components/Realtime/RealtimeSubscriber';
import { useAuth } from '@/lib/auth/use-auth';
import { usePathname } from 'next/navigation';

export type DirtyFormContextType = {
  isDirty: boolean;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
};
export const DirtyFormContext = createContext<DirtyFormContextType>({
  isDirty: false,
  setIsDirty: () => { },
});

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [isDirty, setIsDirty] = useState(false);

  const contextValue = useMemo(
    () => ({ isDirty, setIsDirty }),
    [isDirty]
  );

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]); // isDirty 状態を監視

  const { ready, user } = useAuth();

  const pathname = usePathname();

  // 最後に「承認」したパスを保持する
  const approvedPathRef = useRef(pathname);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // (A) Dirty でなければ、ブラウザのデフォルト動作（ナビゲーション）を許可
      if (!isDirty) {
        return;
      }

      // (B) Dirty な場合
      if (window.confirm('編集内容が保存されていませんが、移動しますか？')) {
        // 「はい」: 遷移を許可
        setIsDirty(false);
        // (Next.js がこの popstate を検知してページ遷移を実行する)
      } else {
        // 「いいえ」: 遷移をキャンセル

        // (重要) Next.js/ブラウザは既に履歴を「戻って」しまっているため、
        // 強制的に「進む」（元のフォームページ）の履歴をスタックに積む
        window.history.pushState(null, '', pathname);
      }
    };

    // popstate イベントをリッスン
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };

  }, [isDirty, pathname, setIsDirty]);

  return (
    <DirtyFormContext.Provider value={contextValue}>
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="grid flex-1 grid-cols-1 md:grid-cols-[16rem_1fr]">
          <Sidebar />

          {/* (既存のロジック) */}
          {ready && user && <RealtimeSubscriber />}
          <MotionMain>{children}</MotionMain>
        </div>
        {/* --- モーダルレイヤ（スライドイン表示） --- */}
        <DetailLayer /> {/* 会話ログ詳細（既存） */}
        <ConsultDetailLayer /> {/* 相談ログ詳細（今回追加） */}
      </div>
    </DirtyFormContext.Provider>
  );
}