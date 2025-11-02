// apps/web/lib/data/notifications.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listLocal, putLocal, getLocal } from '@/lib/db-local';
import type { NotificationRecord, EventLogStrict } from '@repo/shared/types/conversation';

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
  return (await getLocal('events', id)) as EventLogStrict | undefined;
}
