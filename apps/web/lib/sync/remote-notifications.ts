// apps/web/lib/sync/remote-notifications.ts
'use client';

import { supabaseClient } from '@/lib/db-cloud/supabase';
import type { Database } from '@/lib/supabase/types';
import type { NotificationRecord } from '@repo/shared/types/conversation';

type NotificationRow = Database['public']['Tables']['notifications']['Row'];
type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];

function toNotificationRecord(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    type: row.type as NotificationRecord['type'],
    linkedEventId: row.linked_event_id,
    threadId: row.thread_id ?? undefined,
    participants: row.participants ?? undefined,
    snippet: row.snippet ?? undefined,
    occurredAt: row.occurred_at,
    status: row.status as NotificationRecord['status'],
    priority: row.priority ?? 0,
    updated_at: row.updated_at,
  };
}

function toNotificationInsert(record: NotificationRecord): NotificationInsert {
  return {
    id: record.id,
    type: record.type,
    linked_event_id: record.linkedEventId,
    thread_id: record.threadId ?? null,
    participants: record.participants ?? null,
    snippet: record.snippet ?? null,
    occurred_at: record.occurredAt,
    status: record.status,
    priority: record.priority ?? 0,
    updated_at: record.updated_at,
  };
}

/** 直近の通知を取得（デフォルト: 50件） */
export async function remoteFetchRecentNotifications(limit = 50): Promise<NotificationRecord[]> {
  const sb = supabaseClient;
  if (!sb) {
    // SSR/未初期化/未ログインなどで null の可能性があるため安全にスキップ
    return [];
  }
  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`remoteFetchRecentNotifications failed: ${error.message}`);
  return (data ?? []).map(toNotificationRecord);
}


/** 通知のUpsert（既読反映など） */
export async function remoteUpsertNotification(record: NotificationRecord) {
  const sb = supabaseClient;
  if (!sb) {
    // 初期化前は黙ってスキップ（次回同期で収束）
    return;
  }
  const row = toNotificationInsert(record);
  const { error } = await sb
    .from('notifications')
    .upsert(row, { onConflict: 'id' });

  if (error) throw new Error(`remoteUpsertNotification failed: ${error.message}`);
}
