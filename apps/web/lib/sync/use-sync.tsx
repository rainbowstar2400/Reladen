'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseClient } from '@/lib/db-cloud/supabase';
import { bulkUpsert, since } from '@/lib/db-local';
import { SyncPayload, syncPayloadSchema } from '@/types';
import { normalizePulledRow } from '@/lib/sync/pull-normalizer';
import { applyPushAck } from '@/lib/sync/push-ack';
import { makeOutboxKey, listPendingByTable, markSent, markFailed } from '@/lib/sync/outbox';
import { useSettings } from '@/lib/use-settings';

export type SyncPhase = 'offline' | 'online' | 'syncing' | 'error';

const TABLES: SyncPayload['table'][] = [
  'presets',
  'residents',
  'relations',
  'feelings',
  'nicknames',
  'events',
  'consult_answers',
  'world_states',
  'player_profiles',
];

const TABLE_GROUPS: SyncPayload['table'][][] = [
  ['player_profiles', 'presets', 'world_states'],
  ['residents', 'relations', 'feelings'],
  ['nicknames', 'events', 'consult_answers'],
];

type SyncCursor = string | null;
type PulledAtMap = Record<SyncPayload['table'], string | null>;
type CursorMap = Record<SyncPayload['table'], SyncCursor>;

function createInitialTableState<T>(initial: T): Record<SyncPayload['table'], T> {
  return Object.fromEntries(TABLES.map((table) => [table, initial])) as Record<SyncPayload['table'], T>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (id?: string | null) => !!id && UUID_REGEX.test(id);

async function getAccessToken(): Promise<string | null> {
  const sb = supabaseClient;
  if (!sb) return null;
  const { data, error } = await sb.auth.getSession();
  if (error) return null;
  return data?.session?.access_token ?? null;
}

type FetchDiffBody = Pick<SyncPayload, 'changes' | 'since' | 'sinceCursor' | 'sinceVersion'>;

async function fetchDiff(
  table: SyncPayload['table'],
  body: FetchDiffBody,
): Promise<SyncPayload> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error('Auth session missing!');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(`/api/sync/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, table }),
  });
  if (res.status === 409) {
    const text = await res.text().catch(() => '');
    const err = new Error(`sync ${table} blocked (409): ${text || res.statusText}`);
    (err as Error & { nonRetryable?: boolean }).nonRetryable = true;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`sync ${table} failed (${res.status}): ${text || res.statusText}`);
  }

  const json = await res.json();
  return syncPayloadSchema.parse(json);
}

type SyncResult =
  | { ok: true }
  | { ok: false; reason: 'offline' }
  | { ok: false; reason: 'error'; message: string };

function useSyncInternal() {
  const [phase, setPhase] = useState<SyncPhase>('offline');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [tableCursors, setTableCursors] = useState<CursorMap>(() => createInitialTableState<SyncCursor>(null));
  const [lastPulledAt, setLastPulledAt] = useState<PulledAtMap>(() => createInitialTableState<string | null>(null));
  const [error, setError] = useState<string | null>(null);

  const tableCursorsRef = useRef(tableCursors);
  useEffect(() => {
    tableCursorsRef.current = tableCursors;
  }, [tableCursors]);

  const lastPulledAtRef = useRef(lastPulledAt);
  useEffect(() => {
    lastPulledAtRef.current = lastPulledAt;
  }, [lastPulledAt]);

  const { s: settings } = useSettings();
  const syncEnabledRef = useRef(settings.syncEnabled);
  useEffect(() => {
    syncEnabledRef.current = settings.syncEnabled;
  }, [settings.syncEnabled]);

  const retryCountRef = useRef(0);
  const syncingRef = useRef(false);
  const lastRunRef = useRef(0);
  const MIN_INTERVAL_MS = 4000;
  const debounceTimerRef = useRef<number | null>(null);

  const syncAll = useCallback(async (): Promise<SyncResult> => {
    if (!syncEnabledRef.current) {
      setPhase('online');
      return { ok: true };
    }

    if (syncingRef.current) return { ok: true };

    const now = Date.now();
    if (now - lastRunRef.current < MIN_INTERVAL_MS) return { ok: true };

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setPhase('offline');
      return { ok: false, reason: 'offline' };
    }

    syncingRef.current = true;
    lastRunRef.current = now;
    setPhase('syncing');
    setError(null);
    const cycleStartedAt = new Date().toISOString();

    try {
      const syncOneTable = async (
        table: SyncPayload['table'],
        cursor: SyncCursor,
        pulledAt: string | null,
      ): Promise<{ maxSyncVersion: SyncCursor; pulledAt: string }> => {
        const localChanges = await since(table, pulledAt ?? null);
        const isWorldStateTable = table === 'world_states';

        const pending = await listPendingByTable(table);
        const mergedMap = new Map<
          string,
          { data: any; updated_at: string; deleted?: boolean; __key?: string }
        >();

        for (const it of localChanges) {
          const id = (it as any).id;
          if (isWorldStateTable && !isUuid(id)) continue;
          mergedMap.set(id, {
            data: it,
            updated_at: (it as any).updated_at,
            deleted: (it as any).deleted,
          });
        }

        for (const ob of pending) {
          if (isWorldStateTable && !isUuid(ob.id)) {
            await markSent([makeOutboxKey(table, ob.id)]);
            continue;
          }
          const cur = mergedMap.get(ob.id);
          if (!cur || new Date(ob.updated_at).getTime() >= new Date(cur.updated_at).getTime()) {
            mergedMap.set(ob.id, {
              data: ob.data,
              updated_at: ob.updated_at,
              deleted: ob.deleted,
              __key: makeOutboxKey(table, ob.id),
            });
          }
        }
        const merged = Array.from(mergedMap.values());

        const payload = await fetchDiff(table, {
          changes: merged.map((item) => ({
            data: item.data,
            updated_at: item.updated_at,
            deleted: item.deleted,
          })),
          sinceVersion: cursor ?? undefined,
        });

        const cloudChanges = payload.changes.map((c) =>
          normalizePulledRow(table, c.data as Record<string, any>),
        );
        if (cloudChanges.length > 0) {
          await bulkUpsert(table, cloudChanges as any);
        }
        await applyPushAck({
          merged,
          payload,
          markSentFn: markSent,
          markFailedFn: markFailed,
        });

        return {
          maxSyncVersion: payload.maxSyncVersion ?? null,
          pulledAt: cycleStartedAt,
        };
      };

      const currentFailures = new Set<SyncPayload['table']>();
      const rejectReasons = new Map<SyncPayload['table'], unknown>();
      const newCursors: CursorMap = { ...tableCursorsRef.current };
      const newPulledAt: PulledAtMap = { ...lastPulledAtRef.current };

      for (const group of TABLE_GROUPS) {
        const results = await Promise.allSettled(
          group.map((table) =>
            syncOneTable(
              table,
              tableCursorsRef.current[table],
              lastPulledAtRef.current[table],
            ),
          ),
        );

        results.forEach((result, index) => {
          const table = group[index];
          if (result.status === 'rejected') {
            currentFailures.add(table);
            rejectReasons.set(table, result.reason);
            console.error(`Sync failed for ${table}:`, result.reason);
            return;
          }

          newPulledAt[table] = result.value.pulledAt;
          if (result.value.maxSyncVersion !== null) {
            newCursors[table] = result.value.maxSyncVersion;
          } else if (newCursors[table] === null) {
            newCursors[table] = '0';
          }
        });
      }

      const hasNonRetryable = [...rejectReasons.values()].some(
        (reason) => (reason as { nonRetryable?: boolean } | undefined)?.nonRetryable === true,
      );
      if (hasNonRetryable) {
        const err = new Error('Sync blocked: migration mismatch detected. Apply migration 0021.');
        (err as Error & { nonRetryable?: boolean }).nonRetryable = true;
        throw err;
      }

      setTableCursors(newCursors);
      setLastPulledAt(newPulledAt);

      if (currentFailures.size === TABLES.length) {
        throw new Error('All tables failed to sync');
      }

      setLastSyncedAt(new Date().toISOString());
      setPhase('online');
      retryCountRef.current = 0;
      return { ok: true };
    } catch (err: any) {
      if (err?.nonRetryable === true) {
        console.error('Sync non-retryable error:', err);
        setError(err?.message ?? 'unknown');
        setPhase('error');
        retryCountRef.current = 0;
        return { ok: false, reason: 'error', message: err?.message ?? 'unknown' };
      }

      const isAuthError = err?.message === 'Auth session missing!';

      if (isAuthError) {
        console.warn('Sync delayed: auth session not yet available. Retrying...');
        setError(null);
        setPhase('syncing');

        const MAX_RETRIES = 5;
        if (retryCountRef.current < MAX_RETRIES) {
          const base = 1000;
          const backoff = base * Math.pow(2, retryCountRef.current);
          const jitter = Math.floor(Math.random() * 250);
          const delay = Math.min(60000, backoff + jitter);

          retryCountRef.current += 1;
          window.setTimeout(() => {
            void syncAll();
          }, delay);
        } else {
          setError('Auth session timed out.');
          setPhase('error');
          retryCountRef.current = 0;
        }

        return { ok: true };
      }

      console.error('Sync error:', err);
      setError(err?.message ?? 'unknown');
      setPhase('error');

      const MAX_RETRIES = 5;
      if (retryCountRef.current < MAX_RETRIES) {
        const base = 1000;
        const backoff = base * Math.pow(2, retryCountRef.current);
        const jitter = Math.floor(Math.random() * 250);
        const delay = Math.min(60000, backoff + jitter);

        retryCountRef.current += 1;
        window.setTimeout(() => {
          void syncAll();
        }, delay);
      } else {
        retryCountRef.current = 0;
      }

      return { ok: false, reason: 'error', message: err?.message };
    } finally {
      syncingRef.current = false;
    }
  }, []);

  const syncAllRef = useRef(syncAll);
  syncAllRef.current = syncAll;

  const requestDebouncedSync = useCallback(() => {
    if (debounceTimerRef.current != null) return;
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void syncAllRef.current();
    }, 1000);
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setPhase('online');
      requestDebouncedSync();
    };
    const onOffline = () => setPhase('offline');

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if (navigator.onLine) {
      setPhase('online');
    }

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [requestDebouncedSync]);

  useEffect(() => {
    const client = supabaseClient;
    if (!client) return;

    const channels = TABLES.map((table) =>
      client
        .channel(`public:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          requestDebouncedSync();
        })
        .subscribe(),
    );

    return () => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      channels.forEach((ch) => {
        void client.removeChannel(ch);
      });
    };
  }, [requestDebouncedSync]);

  useEffect(() => {
    const onRequest = () => {
      requestDebouncedSync();
    };
    window.addEventListener('reladen:request-sync', onRequest);
    return () => window.removeEventListener('reladen:request-sync', onRequest);
  }, [requestDebouncedSync]);

  useEffect(() => {
    const sb = supabaseClient;
    if (!sb) return;

    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        requestDebouncedSync();
      }
    });

    return () => sub?.subscription?.unsubscribe();
  }, [requestDebouncedSync]);

  return useMemo(
    () => ({
      phase,
      error,
      lastSyncedAt,
      tableCursors,
      sync: syncAll,
      isOnline: phase === 'online',
    }),
    [phase, error, lastSyncedAt, tableCursors, syncAll],
  );
}

type SyncState = ReturnType<typeof useSyncInternal>;

const SyncContext = createContext<SyncState | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const value = useSyncInternal();
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within <SyncProvider>');
  return ctx;
}
