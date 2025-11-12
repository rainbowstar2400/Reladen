'use client';

import Link, { type LinkProps } from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormDirty } from '@/components/providers/FormDirtyProvider';
import React, { type ComponentProps } from 'react';

const LEAVE_CONFIRM_MESSAGE = '編集内容が保存されていませんが、移動しますか？';

type SafeLinkProps = LinkProps & Omit<ComponentProps<'a'>, 'href'>;

/**
 * フォーム編集中 (isDirty) の場合に確認アラートを出す Link コンポーネント
 */
export function SafeLink(props: SafeLinkProps) {
    const { isDirty, setIsDirty } = useFormDirty();
    const router = useRouter();
    const { href, children, onClick, ...rest } = props;

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        // カスタムの onClick イベントがあれば先に実行
        onClick?.(e);

        // 既にデフォルト動作がキャンセルされていれば何もしない
        if (e.defaultPrevented) {
            return;
        }

        if (isDirty) {
            // window.confirm を使用
            if (!window.confirm(LEAVE_CONFIRM_MESSAGE)) {
                e.preventDefault(); // 遷移をキャンセル
            } else {
                // 遷移を許可
                // 遷移が開始するので、isDirty フラグをリセットする
                setIsDirty(false);
            }
        }
    };

    return (
        <Link href={href} {...rest} onClick={handleClick}>
            {children}
        </Link>
    );
}