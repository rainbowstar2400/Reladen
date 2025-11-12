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

  // 最後に「承認」したパスを保持する
  const approvedPathRef = useRef(pathname);
  // router.replace() を実行したことを一時的にマークする
  const isCancellingRef = useRef(false);

  useEffect(() => {
    const currentPath = pathname;
    const previousPath = approvedPathRef.current;

    // (A) "router.replace()" で戻ってきた場合:
    // isCancellingRef.current が true なら、それは「いいえ」を押した
    // 直後のコードによるナビゲーションなので、何もせず許可する。
    // これによりフォームの再マウントを防ぐ
    if (isCancellingRef.current) {
      isCancellingRef.current = false; // フラグをリセット
      // approvedPathRef.current は "previousPath" のまま変更しない
      return;
    }

    // (B) ダーティでない場合、またはパスが変わっていない場合:
    // 遷移を承認し、現在のパスを「承認済み」として記録
    if (!isDirty || currentPath === previousPath) {
      approvedPathRef.current = currentPath;
      return;
    }

    // (C) ダーティかつパスが変わった場合 (「戻る」ボタンなど)
    // 警告ダイアログを表示
    if (window.confirm('編集内容が保存されていませんが、移動しますか？')) {
      // 「はい」: 遷移を許可
      setIsDirty(false); // ダーティ状態を解除
      approvedPathRef.current = currentPath; // 遷移先を「承認済み」として記録
    } else {
      // 「いいえ」: 遷移をキャンセル
      // ユーザーを元のページ (previousPath) に強制的に戻す

      // ★ "replace" を実行するフラグを立てる
      // これにより、(A)のロジックが次のフック実行時に作動する
      isCancellingRef.current = true;
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