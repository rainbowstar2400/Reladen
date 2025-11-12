'use client';

import { useEffect } from 'react';
import { useFormDirty } from '@/components/providers/FormDirtyProvider';

const LEAVE_CONFIRM_MESSAGE = '編集内容が保存されていませんが、移動しますか？';

/**
 * フォームが Dirty なときにブラウザ操作 (リロード/閉じる/戻る) を
 * ブロックするためのフック (onbeforeunload を利用)
 */
export function useLeaveConfirm() {
    const { isDirty, setIsDirty } = useFormDirty();

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                // 標準の確認ダイアログをトリガーする
                e.preventDefault();

                // ほとんどのブラウザではカスタムメッセージは無視されるが、
                // e.returnValue の設定は必要
                e.returnValue = LEAVE_CONFIRM_MESSAGE;
                return LEAVE_CONFIRM_MESSAGE;
            }
        };

        // ブラウザの「戻る/進む」ボタン (History API) を検知
        const handlePopState = (e: PopStateEvent) => {
            if (isDirty) {
                if (!window.confirm(LEAVE_CONFIRM_MESSAGE)) {
                    // 遷移をキャンセル (元の場所に戻す)
                    history.pushState(null, '', location.href);
                } else {
                    // 遷移を許可 (isDirty を解除)
                    setIsDirty(false);
                }
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('popstate', handlePopState);
        };
    }, [isDirty, setIsDirty]);
}