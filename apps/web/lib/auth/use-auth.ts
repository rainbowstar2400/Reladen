// apps/web/lib/auth/use-auth.ts
'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabaseClient } from '@/lib/db-cloud/supabase';

type User = {
    id: string;
    email?: string | null;
    provider?: string | null;
    providers?: string[];     // ★追加: 紐づいている全プロバイダ
};

export function useAuth() {
    const sb = supabaseClient;
    const [user, setUser] = useState<User | null>(null);
    const [ready, setReady] = useState<boolean>(false);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                if (!sb) return; // 未初期化ならローカル動作
                const { data } = await sb.auth.getUser();
                if (!mounted) return;
                if (data?.user) {
                    const identities = (data.user as any)?.identities ?? [];
                    const providers =
                        Array.isArray(identities)
                            ? identities.map((i: any) => i.provider).filter(Boolean)
                            : [];
                    setUser({
                        id: data.user.id,
                        email: data.user.email,
                        provider: data.user.app_metadata?.provider ?? null,
                        providers, // ← ここで参照OK（上で定義済み）
                    });
                } else {
                    setUser(null);
                }
                setReady(true);
            } finally {
                setReady(true);
            }
        })();

        // セッション変化を購読
        const sub = sb?.auth.onAuthStateChange?.((_event, session) => {
            if (!mounted) return;
            const u = session?.user;
            if (u) {
                const identities = (u as any)?.identities ?? [];
                const providers =
                    Array.isArray(identities)
                        ? identities.map((i: any) => i.provider).filter(Boolean)
                        : [];
                setUser({
                    id: u.id,
                    email: u.email,
                    provider: u.app_metadata?.provider ?? null,
                    providers,
                });
            } else {
                setUser(null);
            }
        });
        return () => {
            mounted = false;
            sub?.data?.subscription?.unsubscribe();
        };
    }, [sb]);

    const signInWithGoogle = useCallback(async () => {
        if (!sb) return;
        await sb.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
        });
    }, [sb]);

    const signOut = useCallback(async () => {
        if (!sb) return;
        await sb.auth.signOut();
    }, [sb]);
    const linkWithGoogle = useCallback(async () => {
        if (!sb) return;

        // 1) 新APIがある場合（推奨）
        const maybeLink = (sb.auth as any).linkIdentity;
        if (typeof maybeLink === 'function') {
            await maybeLink({
                provider: 'google',
                options: {
                    redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
                },
            });
            return;
        }

        // 2) フォールバック：そのまま Google で sign-in（同アドレスの既存ユーザーならマージされる構成が多い）
        await sb.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
        });
    }, [sb]);

    return { ready, user, signInWithGoogle, signOut, hasSupabase: !!sb, linkWithGoogle };
}
