// apps/web/lib/sync/remote-notifications.ts
'use client';

import { supabaseClient } from '@/lib/db-cloud/supabase';

type AnyRecord = Record<string, any>;

/** 直近の通知を取得（デフォルト: 50件） */
export async function remoteFetchRecentNotifications(limit = 50): Promise<AnyRecord[]> {
  const sb = supabaseClient;
  const { data, error } = await sb
    .from('notifications')               // ← テーブル名が異なる場合は合わせてください
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`remoteFetchRecentNotifications failed: ${error.message}`);
  return data ?? [];
}

/** 通知のUpsert（既読反映など） */
export async function remoteUpsertNotification(row: AnyRecord) {
  const sb = supabaseClient;
  const { error } = await sb
    .from('notifications')               // ← テーブル名が異なる場合は合わせてください
    .upsert(row, { onConflict: 'id' });
  if (error) throw new Error(`remoteUpsertNotification failed: ${error.message}`);
}
