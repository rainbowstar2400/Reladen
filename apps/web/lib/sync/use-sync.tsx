'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseClient } from '@/lib/db-cloud/supabase';
import { bulkUpsert, since } from '@/lib/db-local';
import { SyncPayload, syncPayloadSchema } from '@/types';
export type SyncPhase = 'offline' | 'online' | 'syncing' | 'error';
import { makeOutboxKey, listPendingByTable, markSent /* , markFailed */ } from '@/lib/sync/outbox';

const TABLES: SyncPayload['table'][] = [
  'residents',
  'relations',
  'feelings',
  'events',
  'consult_answers',
];

// ヘルパー
async function getAccessToken(): Promise<string | null> {
  const sb = supabaseClient;
  if (!sb) return null;
  const { data, error } = await sb.auth.getSession();
  if (error) return null;
  return data?.session?.access_token ?? null;
}

// --- API 呼び出し ---
async function fetchDiff(table: SyncPayload['table'], body: Omit<SyncPayload, 'table'>) {
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
  const [error, setError] = useState<string | null>(null);

  // リトライ回数（指数バックオフ用）
  const retryCountRef = useRef(0);

  // 多重実行ガード & 連発防止
  const syncingRef = useRef(false);
  const lastRunRef = useRef(0);
  const MIN_INTERVAL_MS = 4000;

  // Realtimeイベントのデバウンス
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

        // outbox の pending を取得し、localChanges と LWW でマージ
        const pending = await listPendingByTable(table);
        const mergedMap = new Map<string, { data: any; updated_at: string; deleted?: boolean; __key?: string }>();

        for (const it of localChanges) {
          mergedMap.set((it as any).id, { data: it, updated_at: (it as any).updated_at, deleted: (it as any).deleted });
        }
        for (const ob of pending) {
          const cur = mergedMap.get(ob.id);
          if (!cur || new Date(ob.updated_at).getTime() >= new Date(cur.updated_at).getTime()) {
            mergedMap.set(ob.id, { data: ob.data, updated_at: ob.updated_at, deleted: ob.deleted, __key: makeOutboxKey(table, ob.id) });
          }
        }
        const merged = Array.from(mergedMap.values());

        const payload = await fetchDiff(table, {
          changes: merged.map((item) => ({
            data: item.data,
            updated_at: item.updated_at,
            deleted: item.deleted,
          })),
          since: pendingSince ?? undefined,
        });

        const cloudChanges = payload.changes.map((c) => c.data);
        if (cloudChanges.length > 0) {
          await bulkUpsert(table, cloudChanges as any);
          // 送信成功扱いの outbox を削除
          const sentKeys = merged.filter(m => m.__key).map(m => m.__key!) as string[];
          if (sentKeys.length > 0) {
            await markSent(sentKeys);
          }
        }
      }

      // サーバー時刻を返していない想定なので、クライアント時刻で更新
      setLastSyncedAt(new Date().toISOString());
      setPhase('online');
      // 同期成功時にリトライカウントをリセット
      retryCountRef.current = 0; return { ok: true };
    } catch (err: any) {
      const isAuthError = (err?.message === 'Auth session missing!');

      if (isAuthError) {
        // 1. 認証エラーの場合 (リトライ待ち)
        console.warn('Sync delayed: auth session not yet available. Retrying...');
        setError(null);
        setPhase('syncing'); // 'error' にせず 'syncing' を維持

        const MAX_RETRIES = 5;
        // useRef の値 (retryCountRef.current) を使って判定
        if (retryCountRef.current < MAX_RETRIES) {
          const base = 1000;
          const backoff = base * Math.pow(2, retryCountRef.current); // .current を参照
          const jitter = Math.floor(Math.random() * 250);
          const delay = Math.min(60000, backoff + jitter);

          retryCountRef.current += 1; // カウントを増やす

          window.setTimeout(() => { void syncAll(); }, delay);
        } else {
          // リトライ上限に達した場合
          setError('Auth session timed out.');
          setPhase('error');
          retryCountRef.current = 0; // カウントをリセット
        }

        return { ok: true };

      } else {
        // 2. 認証以外の「本当のエラー」の場合
        console.error('Sync error:', err);
        setError(err?.message ?? 'unknown');
        setPhase('error');

        // (本当のエラーでもリトライを試みるロジック)
        const MAX_RETRIES = 5;
        if (retryCountRef.current < MAX_RETRIES) {
          const base = 1000;
          const backoff = base * Math.pow(2, retryCountRef.current); // .current を参照
          const jitter = Math.floor(Math.random() * 250);
          const delay = Math.min(60000, backoff + jitter);

          retryCountRef.current += 1; // カウントを増やす

          window.setTimeout(() => { void syncAll(); }, delay);
        } else {
          retryCountRef.current = 0; // カウントをリセット
        }

        return { ok: false, reason: 'error', message: err?.message };
      }
    } finally {
      syncingRef.current = false;
    }

  }, [lastSyncedAt, requestDebouncedSync]);

  // online/offline での同期（重複登録・多重実行を避ける）
  useEffect(() => {
    const onOnline = () => {
      setPhase('online');
      requestDebouncedSync(); // (念のためデバウンス)
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

  // 追加: 外部からの明示同期リクエスト（window.dispatchEvent(new Event('reladen:request-sync'))）
  useEffect(() => {
    const onRequest = () => { requestDebouncedSync(); }; // (デバウンス)
    window.addEventListener('reladen:request-sync', onRequest);
    return () => window.removeEventListener('reladen:request-sync', onRequest);
  }, [requestDebouncedSync]);

  // Auth 状態変化で同期をトリガ
  useEffect(() => {
    const sb = supabaseClient;
    if (!sb) return;

    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      // 'INITIAL_SESSION' (初回ロード時) は無視し、
      // 実際にサインイン/アウトした時だけ同期する
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        requestDebouncedSync(); // サインイン完了後に Authorization 付きで再同期
      }
    });

    return () => sub?.subscription?.unsubscribe();
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