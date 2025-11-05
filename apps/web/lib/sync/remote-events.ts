'use client';
import { supabaseClient as sb } from '@/lib/db-cloud/supabase';
import type { EventLogStrict, NotificationRecord } from '@repo/shared/types/conversation';

/** イベントを Supabase に upsert する */
export async function remoteUpsertEvent(ev: EventLogStrict) {
  if (!sb) {
    console.warn('Supabase クライアントが無効なため、イベント同期をスキップしました。');
    return;
  }
  const { error } = await sb.from('events').upsert({
    id: ev.id,
    kind: ev.kind,
    payload: ev.payload,              // JSONB
    updated_at: ev.updated_at,
    deleted: ev.deleted ?? false,
  }).select().single();
  if (error) throw error;
}

/** 通知を Supabase に upsert する */
export async function remoteUpsertNotification(n: NotificationRecord & { deleted: boolean }) {
  if (!sb) {
    console.warn('Supabase クライアントが無効なため、通知同期をスキップしました。');
    return;
  }
  const { error } = await sb.from('notifications').upsert({
    id: n.id,
    type: n.type,
    status: n.status,
    linked_event_id: n.linkedEventId,
    occurred_at: n.occurredAt,
    priority: n.priority ?? 0,
    updated_at: n.updated_at,
    deleted: (n as any).deleted ?? false,
    thread_id: (n as any).threadId ?? null,
    participants: (n as any).participants ?? null,
    snippet: (n as any).snippet ?? null,
  }).select().single();
  if (error) throw error;
}

/** イベント ID を指定して Supabase から取得 */
export async function remoteFetchEventById(id: string) {
  if (!sb) return null;
  const { data, error } = await sb.from('events').select('*').eq('id', id).single();
  if (error) return null;
  return data as { id: string; kind: string; payload: unknown; updated_at: string; deleted: boolean };
}

/** 最新の通知を Supabase から取得 */
export async function remoteFetchRecentNotifications(limit = 30) {
  if (!sb) return [];
  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data as any[];
}
