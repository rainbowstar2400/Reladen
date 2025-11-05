// apps/web/lib/data/notifications.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLocal, putLocal, getLocal } from '@/lib/db-local';
import type { NotificationRecord, EventLogStrict } from '@repo/shared/types/conversation';
import { remoteFetchEventById } from '@/lib/sync/remote-events';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const all = (await listLocal('notifications')) as NotificationRecord[];
      return all
        .slice()
        .sort((a, b) => (b.occurredAt?.localeCompare(a.occurredAt) ?? 0));
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
      await putLocal('notifications', {
        ...n,
        status: 'read',
        updated_at: new Date().toISOString(),
      });
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
  const sorted = arr.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  return typeof opts?.limit === 'number' ? sorted.slice(0, opts.limit) : sorted;
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