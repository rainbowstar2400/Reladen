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

// ニックネーム登録・更新フック（手動設定時は自動的に locked=true）
export function useUpsertNickname() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Nickname> & { locked?: boolean }) => {
      const id = input.id ?? newId();
      const record = await putLocal('nicknames', {
        ...input,
        id,
        // D-3: 手動設定時は自動的に locked=true（明示指定がなければ）
        locked: input.locked ?? true,
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