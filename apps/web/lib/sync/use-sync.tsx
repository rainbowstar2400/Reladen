'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabaseClient } from '@/lib/db-cloud/supabase';
import { bulkUpsert, since } from '@/lib/db-local';
import { SyncPayload, syncPayloadSchema } from '@/types';
export type SyncPhase = 'offline' | 'online' | 'syncing' | 'error';

const TABLES: SyncPayload['table'][] = ['residents', 'relations', 'feelings', 'events'];

type SyncResult =
  | { ok: true }
  | { ok: false; reason: 'offline' }
  | { ok: false; reason: 'error'; message: string };

async function fetchDiff(table: SyncPayload['table'], body: Omit<SyncPayload, 'table'>) {
  const res = await fetch(`/app/api/sync/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, table }),
  });
  if (!res.ok) throw new Error(`sync ${table} failed`);
  const json = await res.json();
  return syncPayloadSchema.parse(json);
}

function useSyncInternal() {
  const [phase, setPhase] = useState<SyncPhase>('offline');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncAll = useCallback(async (): Promise<SyncResult> => {
    if (!navigator.onLine) {
      setPhase('offline');
      return { ok: false, reason: 'offline' };
    }
    setPhase('syncing');
    setError(null);

    try {
      const pendingSince = lastSyncedAt;
      for (const table of TABLES) {
        const localChanges = await since(table, pendingSince);
        const payload = await fetchDiff(table, {
          changes: localChanges.map((item) => ({ data: item, updated_at: item.updated_at, deleted: item.deleted })),
          since: pendingSince ?? undefined,
        });
        const cloudChanges = payload.changes.map((change) => change.data);
        await bulkUpsert(table, cloudChanges as any);
      }
      setLastSyncedAt(new Date().toISOString());
      setPhase('online');
      return { ok: true };
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'unknown';
      setError(message);
      setPhase('error');
      return { ok: false, reason: 'error', message };
    }
  }, [lastSyncedAt]);

  useEffect(() => {
    const handleOnline = () => {
      setPhase('online');
      void syncAll();
    };
    const handleOffline = () => setPhase('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (navigator.onLine) {
      setPhase('online');
      void syncAll();
    }
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncAll]);

  useEffect(() => {
    // null 警告回避：ローカル変数に退避してガード
    const client = supabaseClient;
    if (!client) return;

    const channels = TABLES.map((table) =>
      client
        .channel(`public:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          void syncAll();
        })
        .subscribe()
    );

    return () => {
      channels.forEach((ch) => {
        void client.removeChannel(ch);
      });
    };
  }, [syncAll]);


  return useMemo(
    () => ({
      phase,
      error,
      lastSyncedAt,
      sync: syncAll,
      isOnline: phase === 'online',
    }),
    [phase, error, lastSyncedAt, syncAll]
  );
}

type SyncState = ReturnType<typeof useSyncInternal>;

const SyncContext = createContext<SyncState | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const value = useSyncInternal();
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context) return context;
  return useSyncInternal();
}
