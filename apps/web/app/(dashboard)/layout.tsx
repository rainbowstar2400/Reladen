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
import { usePathname, useRouter } from 'next/navigation';

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
  const router = useRouter();
  // 警告を出す/出さないの判断に使ったパスを保持する
  const navigatedPathRef = useRef(pathname); 

  useEffect(() => {
    const currentPath = pathname;
    const previousPath = navigatedPathRef.current;

    // (A) ダーティでない場合、またはパスが変わっていない場合
    if (!isDirty || currentPath === previousPath) {
      navigatedPathRef.current = currentPath;
      return;
    }

    // (B) ダーティかつパスが変わった場合 (「戻る」ボタンなど)
    // 警告ダイアログを表示
    if (window.confirm('編集内容が保存されていませんが、ページを離れてよろしいですか？')) {
      // 「はい」: 遷移を許可
      setIsDirty(false); // ダーティ状態を解除
      navigatedPathRef.current = currentPath; // 遷移先を「現在のパス」として承認
    } else {
      // 「いいえ」: 遷移をキャンセル
      // ユーザーを元のページ (previousPath) に強制的に戻す
      router.replace(previousPath); 
      // isDirty は true のまま
    }
  }, [pathname, isDirty, router, setIsDirty]);
  
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