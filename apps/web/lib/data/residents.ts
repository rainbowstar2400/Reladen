'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Resident } from '@/types';
import { listLocal, putLocal, markDeleted } from '@/lib/db-local';
import { newId } from '@/lib/newId';
import {
  getOrGenerateTodaySchedule,
  type SleepProfile
} from '../../../../packages/shared/logic/schedule';

const KEY = ['residents'];
// ★ データをフェッチする関数にロジックを追加
async function fetchResidents() {
  const items = await listLocal<Resident>('residents');
  const activeItems = items.filter((item) => !item.deleted);

  // ★ 更新が必要なスケジュールをDBに書き戻すためのリスト
  const updatePromises: Promise<any>[] = [];

  // ★ 取得したデータをループし、スケジュールをチェック・更新
  const processedResidents = activeItems.map((res) => {

    // sleepProfile が未設定、または基準時刻がなければスキップ
    if (!res.sleepProfile || typeof res.sleepProfile !== 'object' || !res.sleepProfile.baseBedtime) {
      return res;
    }

    // SleepProfile 型として解釈 (型エラーを回避するため)
    const currentProfile = res.sleepProfile as unknown as SleepProfile;

    // ★ スケジュールロジックの呼び出し
    const { profile: updatedProfile, needsUpdate } =
      getOrGenerateTodaySchedule(currentProfile);

    // ★ もし日付が古いなどで「更新が必要」と判断されたら
    if (needsUpdate) {
      // console.log(`[Schedule] Resident ${res.id} のスケジュールを更新します`);

      // 5a. ローカルDB (IndexedDB) 更新タスクをリストに追加
      // (res オブジェクト全体を新しい sleepProfile で上書き)
      updatePromises.push(
        // @ts-ignore (putLocal が SleepProfile の更新に対応)
        putLocal('residents', { ...res, sleepProfile: updatedProfile })
      );

      // 5b. UIには、DB更新後の「新しいプロファイル」を即時反映
      return { ...res, sleepProfile: updatedProfile };
    }

    // 更新が不要だった場合、そのままのデータを返す
    return res;
  });

  // ★ 溜まったDB更新処理をすべて実行 (非同期・並列)
  if (updatePromises.length > 0) {
    Promise.all(updatePromises)
      .then(res => console.log(`[Schedule] ${res.length} 件のローカルスケジュールを更新しました`))
      .catch(err => console.error('[Schedule] ローカルDB更新に失敗:', err));
  }

  // ★ UI (useQuery) には、最新のスケジュールが反映されたデータを返す
  return processedResidents;
}

export function useResidents() {
  // ★ fetchResidents を使うように変更
  return useQuery({ queryKey: KEY, queryFn: fetchResidents });
}

export function useResident(id: string) {
  // (useResident も fetchResidents をベースにしているため、自動で恩恵を受ける)
  return useQuery({ queryKey: [...KEY, id], queryFn: async () => (await fetchResidents()).find((r) => r.id === id) });
}

export function useUpsertResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Resident>) => {
      const id = input.id ?? newId();

      // ★ 既存のレコードを取得（updated_at などのため）
      const existing = (await listLocal<Resident>('residents')).find(r => r.id === id);

      const recordData = {
        ...existing, // 既存の値をベースに
        ...input,   // 新しい入力で上書き
        id,
        updated_at: new Date().toISOString(),
        deleted: false,
      };

      // @ts-ignore (型定義が Zod と一致している前提)
      const record = await putLocal('residents', recordData);
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
      // @ts-ignore (markDeleted が string id を受け取る)
      return markDeleted('residents', id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
