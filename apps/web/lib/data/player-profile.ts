'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlayerProfile } from '@/types';
import { listLocal, putLocal } from '@/lib/db-local';
import { newId } from '@/lib/newId';

const KEY = ['player_profile'];

async function fetchPlayerProfile(): Promise<PlayerProfile | null> {
  const items = await listLocal<PlayerProfile>('player_profiles');
  const active = items.filter((item) => !item.deleted);
  return active[0] ?? null;
}

export function usePlayerProfile() {
  return useQuery({
    queryKey: KEY,
    queryFn: fetchPlayerProfile,
  });
}

export function useUpsertPlayerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<PlayerProfile> & { player_name: string }) => {
      const existing = await fetchPlayerProfile();
      const id = input.id ?? existing?.id ?? newId();

      const record = {
        ...existing,
        ...input,
        id,
        updated_at: new Date().toISOString(),
        deleted: false,
      };

      // @ts-ignore
      await putLocal('player_profiles', record);
      return record as PlayerProfile;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
