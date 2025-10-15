'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Relation } from '@/types';
import { listLocal, putLocal, markDeleted } from '@/lib/db-local';
import { newId } from '@/lib/newId';

const KEY = ['relations'];

async function fetchRelations() {
  const items = await listLocal<Relation>('relations');
  return items.filter((item) => !item.deleted);
}

export function useRelations() {
  return useQuery({ queryKey: KEY, queryFn: fetchRelations });
}

export function useUpsertRelation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Relation>) => {
      const id = input.id ?? newId();
      const ordered = [input.a_id, input.b_id].sort();
      const record = await putLocal('relations', {
        ...input,
        id,
        a_id: ordered[0],
        b_id: ordered[1],
        updated_at: new Date().toISOString(),
        deleted: false,
      });
      return record;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteRelation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await markDeleted('relations', id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
