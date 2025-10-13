'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Resident } from '@reladen/types';
import { listLocal, putLocal, markDeleted } from '@/lib/db-local';
import { v4 as uuid } from 'uuid';

const KEY = ['residents'];

async function fetchResidents() {
  const items = await listLocal<Resident>('residents');
  return items.filter((item) => !item.deleted);
}

export function useResidents() {
  return useQuery({ queryKey: KEY, queryFn: fetchResidents });
}

export function useResident(id: string) {
  return useQuery({ queryKey: [...KEY, id], queryFn: async () => (await fetchResidents()).find((r) => r.id === id) });
}

export function useUpsertResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Resident>) => {
      const id = input.id ?? uuid();
      const record = await putLocal('residents', {
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

export function useDeleteResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await markDeleted('residents', id);
      return id;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
