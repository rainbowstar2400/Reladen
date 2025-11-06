'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseClient } from '@/lib/db-cloud/supabase';
import { bulkUpsert, since } from '@/lib/db-local';
import { SyncPayload, syncPayloadSchema } from '@/types';
export type SyncPhase = 'offline' | 'online' | 'syncing' | 'error';

const TABLES: SyncPayload['table'][] = [
  'residents',
  'relations',
  'feelings',
  'events',
  'consult_answers', // ← 追加
];

// --- API 呼び出し ---
async function fetchDiff(table: SyncPayload['table'], body: Omit<SyncPayload, 'table'>) {
  const res = await fetch(`/api/sync/${table}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, table }),
  });
  if (!res.ok) throw new Error(`sync ${table} failed (${res.status})`);
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
  const [error, setError] = useState<string | null>(null);

  // ★ 多重実行ガード & 連発防止
  const syncingRef = useRef(false);
  const lastRunRef = useRef(0);
  const MIN_INTERVAL_MS = 4000;

  // ★ Realtimeイベントのデバウンス
  const debounceTimerRef = useRef<number | null>(null);
  const requestDebouncedSync = useCallback(() => {
    if (debounceTimerRef.current != null) return;
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void syncAll();
    }, 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const syncAll = useCallback(async (): Promise<SyncResult> => {
    // すでに実行中ならスキップ
    if (syncingRef.current) return { ok: true };

    // スロットル：直前から一定時間経っていなければスキップ
    const now = Date.now();
    if (now - lastRunRef.current < MIN_INTERVAL_MS) return { ok: true };

    // オフラインは実行しない
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setPhase('offline');
      return { ok: false, reason: 'offline' };
    }

    syncingRef.current = true;
    lastRunRef.current = now;
    setPhase('syncing');
    setError(null);

    try {
      const pendingSince = lastSyncedAt;

      for (const table of TABLES) {
        const localChanges = await since(table, pendingSince);
        const payload = await fetchDiff(table, {
          changes: localChanges.map((item) => ({
            data: item,
            updated_at: item.updated_at,
            deleted: item.deleted,
          })),
          since: pendingSince ?? undefined,
        });

        const cloudChanges = payload.changes.map((c) => c.data);
        if (cloudChanges.length > 0) {
          await bulkUpsert(table, cloudChanges as any);
        }
      }

      // サーバー時刻を返していない想定なので、クライアント時刻で更新
      setLastSyncedAt(new Date().toISOString());
      setPhase('online');
      return { ok: true };
    } catch (err: any) {
      console.error('Sync error:', err);
      setError(err?.message ?? 'unknown');
      setPhase('error');
      return { ok: false, reason: 'error', message: err?.message };
    } finally {
      syncingRef.current = false;
    }
  }, [lastSyncedAt]);

  // 初回マウント時：1回だけ同期
  useEffect(() => {
    let t = window.setTimeout(() => { void syncAll(); }, 0);
    return () => window.clearTimeout(t);
  }, [syncAll]);

  // online/offline での同期（重複登録・多重実行を避ける）
  useEffect(() => {
    const onOnline = () => {
      setPhase('online');
      void syncAll();
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
  }, [syncAll]);

  // Supabase Realtime 変更 → デバウンスして同期
  useEffect(() => {
    const client = supabaseClient;
    if (!client) return;

    const channels = TABLES.map((table) =>
      client
        .channel(`public:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          requestDebouncedSync(); // ← 直接 sync せずデバウンス
        })
        .subscribe()
    );

    return () => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      channels.forEach((ch) => { void client.removeChannel(ch); });
    };
  }, [requestDebouncedSync]);

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
  const ctx = useContext(SyncContext);
  if (ctx) return ctx;
  return useSyncInternal();
}
