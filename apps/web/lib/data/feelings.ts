'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Feeling } from '@reladen/types';
import { listLocal, putLocal, markDeleted } from '@/lib/db-local';
import { v4 as uuid } from 'uuid';

const KEY = ['feelings'];

async function fetchFeelings() {
  const items = await listLocal<Feeling>('feelings');
  return items.filter((item) => !item.deleted);
}

export function useFeelings() {
  return useQuery({ queryKey: KEY, queryFn: fetchFeelings });
}

export function useUpsertFeeling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Feeling>) => {
      const id = input.id ?? uuid();
      const record = await putLocal('feelings', {
        ...input,
        id,
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

export function useDeleteFeeling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await markDeleted('feelings', id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
