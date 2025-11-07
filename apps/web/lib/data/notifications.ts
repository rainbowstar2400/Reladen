// apps/web/lib/data/notifications.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLocal, putLocal, getLocal } from '@/lib/db-local';
import type { NotificationRecord, EventLogStrict } from '@repo/shared/types/conversation';
import { remoteFetchEventById } from '@/lib/sync/remote-events';
import { bulkUpsert } from '@/lib/db-local'; // ★ 追加（ローカルへ取り込み）
import { remoteFetchRecentNotifications, remoteUpsertNotification } from '@/lib/sync/remote-notifications'; // ★ 追加

/**
* 通知の並び順を共通化：
* - まず occurredAt の降順
* - 同時刻の場合は updated_at の降順
*/
function sortNotifications(items: NotificationRecord[]): NotificationRecord[] {
  return [...items].sort((a, b) => {
    const p = (b.occurredAt ?? '').localeCompare(a.occurredAt ?? '');
    if (p !== 0) return p;
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      // 1) まずローカルを即時返す
      const localAll = (await listLocal('notifications')) as NotificationRecord[];
      const localFiltered = localAll.filter((n) => n.status !== 'archived');
      let current = sortNotifications(localFiltered);

      // 2) オンラインならクラウド取り込み → ローカルへ反映 → 再読み込み
      if (typeof navigator === 'undefined' || !navigator.onLine) {
        return current;
      }

      try {
        const remote = await remoteFetchRecentNotifications(50);
        if (remote?.length) {
          await bulkUpsert('notifications', remote as any);
          const after = (await listLocal('notifications')) as NotificationRecord[];
          const afterFiltered = after.filter((n) => n.status !== 'archived');
          current = sortNotifications(afterFiltered);
        }
      } catch (e) {
        // ネットワーク等の一時失敗は無視（ローカル表示を維持）
        console.warn('[notifications] remote fetch skipped:', (e as any)?.message);
      }

      return current;
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const n = (await getLocal('notifications', id)) as NotificationRecord | undefined;
      if (!n) return;
      if (n.status === 'read') return;

      const now = new Date().toISOString();
      const updated: NotificationRecord = {
        ...n,
        status: 'read',
        updated_at: now,
      };

      // 1) ローカル更新
      await putLocal('notifications', updated as any);

      // 2) クラウドへ反映（失敗してもUIはそのまま）
      try {
        await remoteUpsertNotification(updated as any);
      } catch (e) {
        console.warn('[notifications] remote upsert failed:', (e as any)?.message);
      }
    },

    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export async function fetchEventById(id: string) {
  const local = await getLocal('events', id);
  if (local) return local;
  // remote fallback
  const remote = await remoteFetchEventById(id);
  if (!remote) return null;
  // ローカルへ反映（以降はオフラインでも読める）
  await putLocal('events', {
    id: remote.id,
    kind: remote.kind,
    payload: remote.payload,
    updated_at: remote.updated_at,
    deleted: remote.deleted ?? false,
  } as any);
  return await getLocal('events', id);
}

export async function listNotifications(opts?: { limit?: number }): Promise<NotificationRecord[]> {
  const arr = (await listLocal('notifications')) as unknown as NotificationRecord[];
  // こちらも archived を除外し、共通ソートへ統一
  const filtered = arr.filter((n) => n.status !== 'archived');
  const sorted = sortNotifications(filtered);
  return (typeof opts?.limit === 'number') ? sorted.slice(0, opts.limit) : sorted;
}

export async function getUnreadCount(): Promise<number> {
  const arr = (await listLocal('notifications')) as unknown as NotificationRecord[];
  return arr.filter((n) => n.status === 'unread').length;
}

export async function markAsRead(notificationId: string): Promise<void> {
  const arr = (await listLocal('notifications')) as unknown as NotificationRecord[];
  const found = arr.find((n) => n.id === notificationId);
  if (!found) return;
  const now = new Date().toISOString();
  await putLocal('notifications', { ...found, status: 'read', updated_at: now });
}