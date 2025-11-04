'use client';
import { supabaseClient as sb } from '@/lib/db-cloud/supabase'
import type { EventLogStrict, NotificationRecord } from '@repo/shared/types/conversation';

export async function remoteUpsertEvent(ev: EventLogStrict) {
  const { error } = await sb.from('events').upsert({
    id: ev.id,
    kind: ev.kind,
    payload: ev.payload,              // JSONB
    updated_at: ev.updated_at,
    deleted: ev.deleted ?? false,
  }).select().single();
  if (error) throw error;
}

export async function remoteUpsertNotification(n: NotificationRecord & { deleted: boolean }) {
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

export async function remoteFetchEventById(id: string) {
  const { data, error } = await sb.from('events').select('*').eq('id', id).single();
  if (error) return null;
  return data as { id: string; kind: string; payload: unknown; updated_at: string; deleted: boolean };
}

export async function remoteFetchRecentNotifications(limit = 30) {
  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data as any[];
}
