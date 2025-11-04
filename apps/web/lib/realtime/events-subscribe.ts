'use client';
import { sb } from '@/lib/supabase/client';
import { putLocal } from '@/lib/db-local';

export function subscribeRealtime(
  onChange?: (table: 'events' | 'notifications', row: any) => void
) {
  const ch = sb.channel('reladen_realtime');

  ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, async (payload) => {
    const row = payload.new;
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
    const row = payload.new;
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

  // ★ ここがポイント：同期クリーンアップ（Promiseを返さない）
  return () => {
    try {
      void sb.removeChannel(ch); // 結果は捨てる（型は void として扱われ、EffectCleanup要件を満たす）
    } catch {
      /* no-op */
    }
  };
}
