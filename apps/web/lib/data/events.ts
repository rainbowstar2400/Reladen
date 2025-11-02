'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EventLog } from '@/types';
import { listLocal, putLocal } from '@/lib/db-local';
import { newId } from '@/lib/newId';
import { eventSchemaStrict, EventLogStrict } from '@repo/shared/types';

const PAGE_SIZE = 20;

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

export function useEvents() {
  return useInfiniteQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });
}

export function useAddEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<EventLog>) => {
      const id = input.id ?? newId();
      return putLocal('events', {
        ...input,
        id,
        updated_at: new Date().toISOString(),
        deleted: false,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

mutationFn: async (input: Partial<EventLogStrict>) => {
  // Base を含めた strict 版でパース（失敗＝データ不正を確実に発見）
  const parsed = eventSchemaStrict.parse({
    ...input,
    id: input.id ?? newId(),
    updated_at: input.updated_at ?? new Date().toISOString(),
    deleted: input.deleted ?? false,
  });

  return putLocal('events', parsed);
}