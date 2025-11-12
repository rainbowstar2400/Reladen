'use client';

import { useEffect, useRef } from 'react';
import { useFormDirty } from '@/components/providers/FormDirtyProvider';

const LEAVE_CONFIRM_MESSAGE = '編集内容が保存されていませんが、移動しますか？';

/**
 * フォームが Dirty なときにブラウザ操作 (リロード/閉じる/戻る) を
 * ガードするためのフック
 * (History API を使用した "番兵" アプローチ)
 */
export function useLeaveConfirm() {
    const { isDirty, setIsDirty } = useFormDirty();

    // isDirty の最新値を Ref に保存 (popstate ハンドラが最新値を見るため)
    const isDirtyRef = useRef(isDirty);
    useEffect(() => {
        isDirtyRef.current = isDirty;
    }, [isDirty]);

    useEffect(() => {
        // リロード / タブ閉じのガード (beforeunload) 
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirtyRef.current) {
                // 標準の確認ダイアログをトリガー
                e.preventDefault();
                e.returnValue = LEAVE_CONFIRM_MESSAGE; // (古いブラウザ用)
                return LEAVE_CONFIRM_MESSAGE;
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);


        // 「戻る/進む」操作のガード (popstate)

        // popstate ハンドラ (「戻る」が押されたときに発火)
        const handlePopState = (e: PopStateEvent) => {
            // isDirty でないなら、何もせず通常の遷移を実行
            if (!isDirtyRef.current) {
                return;
            }

            // isDirty の場合:
            const ok = window.confirm(LEAVE_CONFIRM_MESSAGE);

            if (ok) {
                // 「OK」: 遷移を許可
                // isDirty 状態を解除し、次の遷移をブロックしないようにする
                setIsDirty(false);
                isDirtyRef.current = false;
            } else {
                // 「キャンセル」: 遷移をブロック
                // (重要) 現在のページに再度 "番兵" を push して、
                // ブラウザの履歴スタックを元に戻す
                history.pushState(null, '', location.href);
            }
        };

        // (重要) isDirty が true になった瞬間に「番兵」を push する
        if (isDirty) {
            // 現在の履歴スタック: [..., (編集ページ)]
            // これを実行すると: [..., (編集ページ), (編集ページ・番兵)]
            // この状態で「戻る」を押すと、(編集ページ・番兵) -> (編集ページ) に
            // 戻ろうとして popstate が発火する。
            history.pushState(null, '', location.href);

            // popstate リスナーを追加
            window.addEventListener('popstate', handlePopState);
        }

        // クリーンアップ (isDirty が false になった時、またはアンマウント時)
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);

            // popstate リスナーを削除
            window.removeEventListener('popstate', handlePopState);

            // (補足)
            // isDirty が false になった (保存された) 場合、
            // このクリーンアップが走り、次の Effect では isDirty が false なので
            // リスナーは追加されません。
            //
            // OK を押して遷移した場合、isDirty が false になり
            // (またはアンマウントで) クリーンアップが走ります。
        };

    }, [isDirty, setIsDirty]); // isDirty の状態変更を監視
}