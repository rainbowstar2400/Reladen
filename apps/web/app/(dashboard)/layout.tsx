'use client'; // フックを使うためクライアントコンポーネントに

import {
  ReactNode,
  useState,
  useMemo,
  useContext,
  useEffect,
  createContext,
} from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MotionMain } from '@/components/layout/motion-main';
import DetailLayer from '@/components/logs/detail-layer';
import ConsultDetailLayer from '@/components/consults/detail-layer';
import RealtimeSubscriber from '@/components/Realtime/RealtimeSubscriber';
import { useAuth } from '@/lib/auth/use-auth';

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