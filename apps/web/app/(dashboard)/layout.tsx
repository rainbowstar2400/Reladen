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
  // history.pushState() を実行したことを一時的にマークする
  const isCancellingRef = useRef(false);

  useEffect(() => {
    const currentPath = pathname;
    const previousApprovedPath = approvedPathRef.current;

    // (A) "pushState" で戻ってきた場合:
    // isCancellingRef.current が true なら、それは「キャンセル」操作
    // 直後のコードによるナビゲーションなので、何もせず許可する。
    // これによりフォームの再マウントを防ぐ
    if (isCancellingRef.current) {
      isCancellingRef.current = false; // フラグをリセット
      // approvedPathRef.current は "previousApprovedPath" のまま変更しない
      return;
    }

    // (B) ダーティでない場合、またはパスが変わっていない場合:
    // 遷移を承認し、現在のパスを「承認済み」として記録
    if (!isDirty || currentPath === previousApprovedPath) {
      approvedPathRef.current = currentPath;
      return;
    }

    // (C) ダーティであり、かつパスが変わった場合 (「戻る」ボタンなど)
    // 警告ダイアログを表示
    if (window.confirm('編集内容が保存されていませんが、移動しますか？')) {
      // 「はい」: 遷移を許可
      setIsDirty(false); // ダーティ状態を解除
      approvedPathRef.current = currentPath; // 遷移先を「承認済み」として記録
    } else {
      // 「いいえ」: 遷移をキャンセル

      // (重要) Next.js router ではなく、ブラウザの history API を
      // 直接使い、URLだけを元に戻す。
      // 「戻る」操作を相殺するために「進む」操作(pushState) を実行する

      // ★ "pushState" を実行するフラグを立てる
      // これにより、(A)のロジックが次のフック実行時に作動する
      isCancellingRef.current = true;
      window.history.pushState(null, '', previousApprovedPath);

      // approvedPathRef は元のまま (previousApprovedPath) にしておく
    }
  }, [pathname, isDirty, setIsDirty]); // 依存配列

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