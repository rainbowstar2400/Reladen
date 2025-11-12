'use client';

import { useEffect, useRef } from 'react';
import { useFormDirty } from '@/components/providers/FormDirtyProvider';
import { usePathname } from 'next/navigation';

const LEAVE_CONFIRM_MESSAGE = '編集内容が保存されていませんが、移動しますか？';

/**
 * フォームが Dirty なときにブラウザ操作 (リロード/閉じる/戻る) を
 * ブロックするためのフック (onbeforeunload と popstate を利用)
 */
export function useLeaveConfirm() {
    const { isDirty, setIsDirty } = useFormDirty();

    // isDirty の最新値を Ref に保存
    // イベントリスナーが常に最新の isDirty 状態を参照できるようにするため
    const isDirtyRef = useRef(isDirty);
    useEffect(() => {
        isDirtyRef.current = isDirty;
    }, [isDirty]);

    // 現在の（編集ページの）パスを Ref に保存
    const pathname = usePathname();
    const lastPathRef = useRef(pathname);

    useEffect(() => {
        // ページが変更されるたびに Ref を更新
        // (フォームが Dirty でない＝安全な状態のときだけ更新)
        if (!isDirtyRef.current) {
            lastPathRef.current = pathname;
        }
    }, [pathname]); // isDirtyRef.current は依存配列に含めない


    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            // Ref の最新値を見る
            if (isDirtyRef.current) {
                e.preventDefault();
                e.returnValue = LEAVE_CONFIRM_MESSAGE;
                return LEAVE_CONFIRM_MESSAGE;
            }
        };

        const handlePopState = (e: PopStateEvent) => {
            // Ref の最新値を見る
            if (isDirtyRef.current) {
                if (!window.confirm(LEAVE_CONFIRM_MESSAGE)) {
                    // 「キャンセル」された場合
                    // 遷移をキャンセルし、保存しておいた編集ページの URL (Ref) に戻す
                    history.pushState(null, '', lastPathRef.current);
                } else {
                    // 遷移を許可 (isDirty を解除)
                    setIsDirty(false); // グローバル状態を更新
                    isDirtyRef.current = false; // Ref も更新
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

        // 依存配列から isDirty を削除 (リスナーの登録/解除は1回だけ)
    }, [setIsDirty]);
}