'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EventLog } from '@/types';
import { listLocal, putLocal } from '@/lib/db-local';
import { newId } from '@/lib/newId';
import { eventSchemaStrict, EventLogStrict } from '@repo/shared/types';

const PAGE_SIZE = 20;
const RESIDENT_EVENT_LIMIT = 15;

async function fetchEvents({ pageParam = 0 }: { pageParam?: number }) {
  const items = (await listLocal<EventLog>('events'))
    .filter((item) => !item.deleted)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const start = pageParam * PAGE_SIZE;
  return {
    items: items.slice(start, start + PAGE_SIZE),
    nextPage: start + PAGE_SIZE < items.length ? pageParam + 1 : undefined,
  };
}

function includesResident(value: unknown, residentId: string): boolean {
  return Array.isArray(value) && value.some((entry) => entry === residentId);
}

function isResidentRelated(item: EventLog, residentId: string): boolean {
  const payload = (item as any)?.payload ?? {};
  if (includesResident(payload?.participants, residentId)) return true;
  if (payload?.residentId === residentId) return true;
  if (payload?.fromId === residentId || payload?.toId === residentId) return true;
  if (payload?.from_id === residentId || payload?.to_id === residentId) return true;
  return false;
}

export async function fetchResidentRelatedEvents(
  residentId: string,
  limit = RESIDENT_EVENT_LIMIT,
): Promise<EventLogStrict[]> {
  if (!residentId) return [];
  const parsedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : RESIDENT_EVENT_LIMIT;
  const items = (await listLocal<EventLog>('events'))
    .filter((item) => !item.deleted)
    .filter((item) => isResidentRelated(item, residentId))
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, parsedLimit)
    .map((item) => eventSchemaStrict.safeParse(item))
    .filter((result): result is { success: true; data: EventLogStrict } => result.success)
    .map((result) => result.data);
  return items;
}

export function useEvents() {
  return useInfiniteQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });
}

export function useResidentRelatedEvents(
  residentId: string,
  limit = RESIDENT_EVENT_LIMIT,
) {
  return useQuery({
    queryKey: ['events', 'resident-related', residentId, limit],
    queryFn: () => fetchResidentRelatedEvents(residentId, limit),
    enabled: Boolean(residentId),
  });
}

export function useAddEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<EventLog>) => {
      const id = input.id ?? newId();

      // 厳密スキーマで検証（失敗なら throw）
      eventSchemaStrict.parse({
        id,
        kind: input.kind,
        payload: input.payload,
        updated_at: new Date().toISOString(),
        deleted: false,
        owner_id: (input as any).owner_id ?? null,
      });

      return putLocal('events', {
        ...input,
        id,
        updated_at: new Date().toISOString(),
        deleted: false,
      } as EventLog);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
