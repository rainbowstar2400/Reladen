'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Relation } from '@/types';
import { listLocal, putLocal, markDeleted } from '@/lib/db-local';
import { newId } from '@/lib/newId';
import { buildRelationDedupPlan, normalizeRelationPair } from '@/lib/data/relation-pair';

const KEY = ['relations'];

async function fetchRelations() {
  const items = await listLocal<Relation>('relations');
  return items.filter((item) => !item.deleted);
}

export function useRelations() {
  return useQuery({ queryKey: KEY, queryFn: fetchRelations });
}

export function useRelation(id: string) {
   return useQuery({
     queryKey: [...KEY, id],
     queryFn: async () => (await fetchRelations()).find((r) => r.id === id),
   });
 }

export function useUpsertRelation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Relation>) => {
      if (typeof input.a_id !== 'string' || typeof input.b_id !== 'string') {
        throw new Error('[useUpsertRelation] a_id and b_id are required.');
      }
      const now = new Date().toISOString();
      const pair = normalizeRelationPair(input.a_id, input.b_id);
      const allRelations = await listLocal<Relation>('relations');
      const dedup = buildRelationDedupPlan(allRelations, now);
      await Promise.all(dedup.tombstones.map((row) => putLocal('relations', row)));

      const existingCanonical = dedup.canonicalByKey.get(pair.key);
      const id = existingCanonical?.id ?? input.id ?? newId();
      const record = await putLocal('relations', {
        ...input,
        id,
        a_id: pair.aId,
        b_id: pair.bId,
        updated_at: now,
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
