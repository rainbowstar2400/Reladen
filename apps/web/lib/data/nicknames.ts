'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Nickname } from '@/types'; 
import { listLocal, putLocal, markDeleted } from '@/lib/db-local';
import { newId } from '@/lib/newId';

const KEY = ['nicknames'];

async function fetchNicknames() {
  const items = await listLocal<Nickname>('nicknames');
  return items.filter((item) => !item.deleted);
}

// 全件取得フック
export function useNicknames() {
  return useQuery({ queryKey: KEY, queryFn: fetchNicknames });
}

// （参考）今後ニックネームを登録・更新するための Upsert フック
export function useUpsertNickname() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Nickname>) => {
      const id = input.id ?? newId();
      const record = await putLocal('nicknames', {
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