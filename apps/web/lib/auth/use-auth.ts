// apps/web/lib/auth/use-auth.ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabaseClient } from '@/lib/db-cloud/supabase';

export type User = {
  id: string;
  email?: string | null;
  provider?: string | null;
  providers?: string[];
};

const SYNC_EVENTS: AuthChangeEvent[] = ['SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT'];

async function syncServerSession(event: AuthChangeEvent, session: Session | null) {
  if (!SYNC_EVENTS.includes(event)) return;
  try {
    await fetch('/api/auth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, session }),
    });
  } catch (error) {
    console.warn('[Auth] Failed to sync session to server', error);
  }
}

function toUser(sessionUser: SupabaseUser | null | undefined): User | null {
  if (!sessionUser) return null;
  const identities = (sessionUser as any)?.identities ?? [];
  const providers = Array.isArray(identities)
    ? identities.map((i: any) => i?.provider).filter(Boolean)
    : [];
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    provider: sessionUser.app_metadata?.provider ?? null,
    providers,
  };
}

export function useAuth() {
  const sb = supabaseClient;
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!sb) {
      setReady(true);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const { data } = await sb.auth.getSession();
        const session = data?.session ?? null;
        await syncServerSession(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
        if (!mounted) return;
        setUser(toUser(session?.user));
      } finally {
        if (mounted) setReady(true);
      }
    })();

    const { data: sub } = sb.auth.onAuthStateChange(async (event, session) => {
      await syncServerSession(event, session);
      if (!mounted) return;
      setUser(toUser(session?.user));
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
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
    await syncServerSession('SIGNED_OUT', null);
  }, [sb]);

  const linkWithGoogle = useCallback(async () => {
    if (!sb) return;

    const maybeLink = (sb.auth as any).linkIdentity;
    if (typeof maybeLink === 'function') {
      await maybeLink({
        provider: 'google',
        options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
      });
      return;
    }

    await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
  }, [sb]);

  return { ready, user, signInWithGoogle, signOut, hasSupabase: !!sb, linkWithGoogle };
}
