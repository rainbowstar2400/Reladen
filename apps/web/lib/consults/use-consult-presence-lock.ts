'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseClient } from '@/lib/db-cloud/supabase';

const CONSULT_LOCK_SESSION_KEY = 'reladen:consult-lock:session-id';

type PresenceMeta = {
  sessionId?: string;
};

type PresenceState = Record<string, PresenceMeta[]>;

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const existing = sessionStorage.getItem(CONSULT_LOCK_SESSION_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    sessionStorage.setItem(CONSULT_LOCK_SESSION_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

export function hasForeignSessionForSameUser(
  state: PresenceState,
  userId: string,
  currentSessionId: string,
) {
  const ownPresence = state[userId] ?? [];
  return ownPresence.some((meta) => meta?.sessionId && meta.sessionId !== currentSessionId);
}

export function useConsultPresenceLock(consultId: string | null | undefined) {
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const sessionId = useMemo(() => getOrCreateSessionId(), []);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<NonNullable<typeof supabaseClient>['channel']> | null = null;

    const run = async () => {
      if (!consultId || !supabaseClient) {
        if (!cancelled) {
          setLocked(false);
          setReady(true);
        }
        return;
      }

      const { data, error } = await supabaseClient.auth.getUser();
      const userId = data?.user?.id;
      if (error || !userId) {
        if (!cancelled) {
          setLocked(false);
          setReady(true);
        }
        return;
      }

      channel = supabaseClient.channel(`consult-lock:${consultId}`, {
        config: { presence: { key: userId } },
      });

      const recomputeLock = () => {
        if (!channel || cancelled) return;
        const state = channel.presenceState() as PresenceState;
        setLocked(hasForeignSessionForSameUser(state, userId, sessionId));
      };

      channel
        .on('presence', { event: 'sync' }, recomputeLock)
        .on('presence', { event: 'join' }, recomputeLock)
        .on('presence', { event: 'leave' }, recomputeLock);

      channel.subscribe(async (status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          await channel?.track({
            sessionId,
            connectedAt: new Date().toISOString(),
          });
          recomputeLock();
          setReady(true);
        }
      });
    };

    void run();

    return () => {
      cancelled = true;
      if (channel && supabaseClient) {
        void supabaseClient.removeChannel(channel);
      }
    };
  }, [consultId, sessionId]);

  return { locked, ready };
}

