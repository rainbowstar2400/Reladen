// apps/web/lib/hooks/useLeaveConfirm.ts
'use client';

import { useEffect, useRef } from 'react';
import { useFormDirty } from '@/components/providers/FormDirtyProvider';
import { usePathname, useRouter } from 'next/navigation';

const LEAVE_CONFIRM_MESSAGE = '編集内容が保存されていませんが、移動しますか？';

export function useLeaveConfirm() {
    const { isDirty, setIsDirty } = useFormDirty();
    // useRouter を呼び出し
    const router = useRouter();

    const isDirtyRef = useRef(isDirty);
    useEffect(() => {
        isDirtyRef.current = isDirty;
    }, [isDirty]);

    const pathname = usePathname();
    const lastPathRef = useRef(pathname);

    useEffect(() => {
        // フォームが Dirty でないときだけ、現在のパスを「安全なパス」として保存
        if (!isDirtyRef.current) {
            lastPathRef.current = pathname;
        }
    }, [pathname]);


    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirtyRef.current) {
                e.preventDefault();
                e.returnValue = LEAVE_CONFIRM_MESSAGE;
                return LEAVE_CONFIRM_MESSAGE;
            }
        };

        const handlePopState = (e: PopStateEvent) => {
            if (isDirtyRef.current) {
                if (!window.confirm(LEAVE_CONFIRM_MESSAGE)) {
                    // 「キャンセル」時: history.pushState ではなく router.push で戻す
                    router.push(lastPathRef.current);
                } else {
                    // 「OK」時: グローバル状態をリセット
                    setIsDirty(false);
                    isDirtyRef.current = false;
                }
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('popstate', handlePopState);
        };

        // 依存配列に router と setIsDirty を含める
    }, [router, setIsDirty]);
}