'use client';

import { useEffect, useRef } from 'react';
import { useFormDirty } from '@/components/providers/FormDirtyProvider';
import { usePathname, useRouter } from 'next/navigation';

const LEAVE_CONFIRM_MESSAGE = '編集内容が保存されていませんが、移動しますか？';

/**
 * フォームが Dirty なときにブラウザ操作 (リロード/閉じる/戻る) を
 * ブロックするためのフック
 */
export function useLeaveConfirm() {
    const { isDirty, setIsDirty } = useFormDirty();
    const router = useRouter();
    const pathname = usePathname();

    // ★ 1. isDirty の最新状態を Ref に保存 (変更なし)
    const isDirtyRef = useRef(isDirty);
    useEffect(() => {
        isDirtyRef.current = isDirty;
    }, [isDirty]);

    // このフックが呼び出された時点のパス (編集ページのパス) をRef に一度だけ保存する
    const initialPathRef = useRef(pathname);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            // (リロード/タブ閉じ)
            if (isDirtyRef.current) {
                e.preventDefault();
                e.returnValue = LEAVE_CONFIRM_MESSAGE;
                return LEAVE_CONFIRM_MESSAGE;
            }
        };

        const handlePopState = (e: PopStateEvent) => {
            // (ブラウザの「戻る」ボタン操作)

            // 編集ページのパス (保存済み) と、popstate 後のパス (window.location) を比較
            const currentPath = window.location.pathname;
            const editingPath = initialPathRef.current;

            // isDirty で、かつパスが本当に変わろうとしているか確認
            // (キャンセル操作で router.push すると再度 popstate が発火するため、パスが同じ場合は無視する)
            if (isDirtyRef.current && currentPath !== editingPath) {

                if (!window.confirm(LEAVE_CONFIRM_MESSAGE)) {
                    // 「キャンセル」時:
                    // 保存しておいた編集ページのパス (initialPathRef.current) にApp Router (router.push) を使って戻す。
                    router.push(editingPath);
                } else {
                    // 「OK」時: グローバル状態をリセット
                    setIsDirty(false);
                    isDirtyRef.current = false;
                }
            }
        };

        // リスナーを登録
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('popstate', handlePopState);

        // クリーンアップ
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('popstate', handlePopState);
        };

        // 依存配列を router と setIsDirty のみにする
    }, [router, setIsDirty]);
}