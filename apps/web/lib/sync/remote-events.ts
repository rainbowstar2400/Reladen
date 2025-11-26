'use client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseClient as sb } from '@/lib/db-cloud/supabase';
import type { Database } from '@/lib/supabase/types';
import type { EventLogStrict, NotificationRecord } from '@repo/shared/types/conversation';

async function requireOwnerId(client: SupabaseClient<Database>): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user?.id) {
    throw new Error('Failed to get auth user for notifications');
  }
  return data.user.id;
}

/** イベントを Supabase へ upsert する */
export async function remoteUpsertEvent(ev: EventLogStrict) {
  if (!sb) {
    console.warn('Supabase クライアントが見つからないため、イベント同期をスキップしました。');
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

/** 通知を Supabase へ upsert する */
export async function remoteUpsertNotification(n: NotificationRecord & { deleted: boolean }) {
  if (!sb) {
    console.warn('Supabase クライアントが見つからないため、通知同期をスキップしました。');
    return;
  }
  const ownerId = await requireOwnerId(sb);
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
    owner_id: ownerId,
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

/** 最新のイベントを Supabase から取得 */
export async function remoteFetchRecentEvents(limit = 200): Promise<EventLogStrict[]> {
  if (!sb) return [];
  const { data, error } = await sb
    .from('events')
    .select('id, kind, payload, updated_at, deleted')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('remoteFetchRecentEvents failed:', error.message ?? error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    kind: row.kind,
    payload: row.payload,
    updated_at: row.updated_at,
    deleted: row.deleted ?? false,
  }));
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
