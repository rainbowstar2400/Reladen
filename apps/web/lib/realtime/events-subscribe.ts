'use client';
import { supabaseClient as sb } from '@/lib/db-cloud/supabase';
import { putLocal } from '@/lib/db-local';

export function subscribeRealtime(
  onChange?: (table: 'events' | 'notifications', row: any) => void
) {
  // Supabase 未設定なら購読スキップ（no-op を返す）
  if (!sb) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Supabase 未設定のため Realtime 購読をスキップします。');
    }
    return () => { /* no-op */ };
  }

  // 重要：以降で使うために、非 null を局所変数へ退避しておく
  //       （返り値のクリーンアップ関数のスコープでも null 扱いされないようにする）
  const client = sb; // ← ここで null ではないことが制御フロー上保証されている

  const ch = client.channel('reladen_realtime');

  ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, async (payload) => {
    const row = (payload as any)?.new;
    if (!row) return; // 念のため防御

    await putLocal('events', {
      id: row.id,
      kind: row.kind,
      payload: row.payload,
      updated_at: row.updated_at,
      deleted: row.deleted ?? false,
    } as any);

    onChange?.('events', row);
  });

  ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async (payload) => {
    const row = (payload as any)?.new;
    if (!row) return; // 念のため防御

    await putLocal('notifications', {
      id: row.id,
      type: row.type,
      status: row.status,
      linkedEventId: row.linked_event_id,
      occurredAt: row.occurred_at,
      priority: row.priority ?? 0,
      updated_at: row.updated_at,
      deleted: row.deleted ?? false,
      threadId: row.thread_id ?? undefined,
      participants: row.participants ?? undefined,
      snippet: row.snippet ?? undefined,
    } as any);

    onChange?.('notifications', row);
  });

  ch.subscribe();

  // クリーンアップ：局所の client を使うことで「sb は null かも」を回避
  return () => {
    try {
      void client.removeChannel(ch);
    } catch {
      /* no-op */
    }
  };
}
