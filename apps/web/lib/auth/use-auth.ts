// apps/web/lib/auth/use-auth.ts
'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabaseClient } from '@/lib/db-cloud/supabase';

type User = {
  id: string;
  email?: string | null;
  provider?: string | null;
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
          setUser({
            id: data.user.id,
            email: data.user.email,
            provider: data.user.app_metadata?.provider ?? null,
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
      setUser(
        u ? { id: u.id, email: u.email, provider: u.app_metadata?.provider ?? null } : null
      );
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

  return { ready, user, signInWithGoogle, signOut, hasSupabase: !!sb };
}
