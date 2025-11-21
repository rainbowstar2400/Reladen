'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Resident, Relation, Feeling, Nickname, TempRelationData } from '@/types';
import { listLocal, putLocal, markDeleted } from '@/lib/db-local';
import { newId } from '@/lib/newId';
import {
  getOrGenerateTodaySchedule,
  type SleepProfile
} from '../../../../packages/shared/logic/schedule';

const KEY = ['residents'];
// データをフェッチする関数にロジックを追加
async function fetchResidents() {
  const items = await listLocal<Resident>('residents');
  const activeItems = items.filter((item) => !item.deleted);

  // 更新が必要なスケジュールをDBに書き戻すためのリスト
  const updatePromises: Promise<any>[] = [];

  // 取得したデータをループし、スケジュールをチェック・更新
  const processedResidents = activeItems.map((res) => {

    // sleepProfile が未設定、または基準時刻がなければスキップ
    if (!res.sleepProfile || typeof res.sleepProfile !== 'object' || !res.sleepProfile.baseBedtime) {
      return res;
    }

    // SleepProfile 型として解釈 (型エラーを回避するため)
    const currentProfile = res.sleepProfile as unknown as SleepProfile;

    // スケジュールロジックの呼び出し
    const { profile: updatedProfile, needsUpdate } =
      getOrGenerateTodaySchedule(currentProfile);

    // もし日付が古いなどで「更新が必要」と判断されたら
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

  // 溜まったDB更新処理をすべて実行 (非同期・並列)
  if (updatePromises.length > 0) {
    Promise.all(updatePromises)
      .then(res => console.log(`[Schedule] ${res.length} 件のローカルスケジュールを更新しました`))
      .catch(err => console.error('[Schedule] ローカルDB更新に失敗:', err));
  }

  // UI (useQuery) には、最新のスケジュールが反映されたデータを返す
  return processedResidents;
}

export function useResidents() {
  // fetchResidents を使うように変更
  return useQuery({ queryKey: KEY, queryFn: fetchResidents });
}

export function useResidentNameMap() {
  const { data: residents } = useResidents();

  return React.useMemo(() => {
    const map: Record<string, string> = {};
    residents?.forEach((resident) => {
      map[resident.id] = resident.name;
    });
    return map;
  }, [residents]);
}

/**
 * 任意のテキスト内に含まれる住人ID（UUID）を、日本語名に置き換える簡易ヘルパー。
 * - 元の文字列を壊さず、対応するIDだけをまとめて差し替える。
 * - 住人名がまだ取得できていない場合は、元のIDをそのまま返す。
 */
export function replaceResidentIds(
  text: string,
  residentNameMap: Record<string, string>,
): string {
  let result = text;
  for (const [id, name] of Object.entries(residentNameMap)) {
    if (!id || !name) continue;
    // replaceAll が利用できない環境でも動作するように split/join で置換する
    result = result.split(id).join(name);
  }
  return result;
}

export function useResident(id?: string) {
  // id が未定義のときはクエリを走らせない
  return useQuery({
    queryKey: [...KEY, id ?? ''],
    queryFn: async () => {
      if (!id) return undefined;
      return (await fetchResidents()).find((r) => r.id === id);
    },
    enabled: Boolean(id),
  });
}

// 関係データをまとめて保存するヘルパー関数
// (useUpsertResident の内部でのみ使用)
async function saveAllRelationData(
  currentId: string,
  relations: Record<string, TempRelationData>,
  ownerId: string | null | undefined
) {
  // 事前に既存データをすべて取得 (ループ内で listLocal すると遅いため)
  const allRelations = await listLocal<Relation>('relations');
  const allFeelings = await listLocal<Feeling>('feelings');
  const allNicknames = await listLocal<Nickname>('nicknames');

  const promises: Promise<any>[] = [];
  const now = new Date().toISOString();

  for (const [targetId, data] of Object.entries(relations)) {
    // 1. Relation (関係性)
    const existingRelation = allRelations.find(r => (r.a_id === currentId && r.b_id === targetId));
    const relationPayload: Relation = {
      // @ts-ignore
      id: existingRelation?.id ?? newId(),
      a_id: currentId,
      b_id: targetId,
      type: data.relationType,
      updated_at: now,
      deleted: false,
      owner_id: ownerId,
    };
    promises.push(putLocal('relations', relationPayload));

    // 2. Feeling (自分 -> 相手)
    const existingFeelingTo = allFeelings.find(f => f.from_id === currentId && f.to_id === targetId);
    const feelingToPayload: Feeling = {
      // @ts-ignore
      id: existingFeelingTo?.id ?? newId(),
      from_id: currentId,
      to_id: targetId,
      label: data.feelingLabelTo,
      score: data.feelingScoreTo,
      updated_at: now,
      deleted: false,
      owner_id: ownerId,
    };
    promises.push(putLocal('feelings', feelingToPayload));

    // 3. Feeling (相手 -> 自分)
    const existingFeelingFrom = allFeelings.find(f => f.from_id === targetId && f.to_id === currentId);
    const feelingFromPayload: Feeling = {
      // @ts-ignore
      id: existingFeelingFrom?.id ?? newId(),
      from_id: targetId,
      to_id: currentId,
      label: data.feelingLabelFrom,
      score: data.feelingScoreFrom,
      updated_at: now,
      deleted: false,
      owner_id: ownerId,
    };
    promises.push(putLocal('feelings', feelingFromPayload));

    // 4. Nickname (自分 -> 相手)
    const existingNicknameTo = allNicknames.find(n => n.from_id === currentId && n.to_id === targetId);
    if (data.nicknameTo.trim()) {
      const nicknameToPayload: Nickname = {
        // @ts-ignore
        id: existingNicknameTo?.id ?? newId(),
        from_id: currentId,
        to_id: targetId,
        nickname: data.nicknameTo.trim(),
        updated_at: now,
        deleted: false,
        owner_id: ownerId,
      };
      promises.push(putLocal('nicknames', nicknameToPayload));
    } else if (existingNicknameTo) {
      // フォームが空欄 = 削除
      promises.push(markDeleted('nicknames', existingNicknameTo.id));
    }

    // 5. Nickname (相手 -> 自分)
    const existingNicknameFrom = allNicknames.find(n => n.from_id === targetId && n.to_id === currentId);
    if (data.nicknameFrom.trim()) {
      const nicknameFromPayload: Nickname = {
        // @ts-ignore
        id: existingNicknameFrom?.id ?? newId(),
        from_id: targetId,
        to_id: currentId,
        nickname: data.nicknameFrom.trim(),
        updated_at: now,
        deleted: false,
        owner_id: ownerId,
      };
      promises.push(putLocal('nicknames', nicknameFromPayload));
    } else if (existingNicknameFrom) {
      // フォームが空欄 = 削除
      promises.push(markDeleted('nicknames', existingNicknameFrom.id));
    }
  }

  // すべてのDB書き込みを並列実行
  await Promise.all(promises);
}

export function useUpsertResident() {
  const queryClient = useQueryClient();
  return useMutation({
    // 住民データと関係データを受け取る
    mutationFn: async (input: { resident: Partial<Resident>, relations?: Record<string, TempRelationData> }) => {
      const { resident: residentInput, relations: relationsInput } = input;
      const id = residentInput.id ?? newId();

      // 既存のレコードを取得（updated_at などのため）
      const existing = (await listLocal<Resident>('residents')).find(r => r.id === id);

      const recordData = {
        ...existing, // 既存の値をベースに
        ...residentInput,   // 新しい入力で上書き
        id,
        updated_at: new Date().toISOString(),
        deleted: false,
      };

      // @ts-ignore (型定義が Zod と一致している前提)
      const record = await putLocal('residents', recordData);
      const currentId = record.id;

      // 関係データがあれば保存処理を呼び出す
      if (relationsInput && currentId) {
        await saveAllRelationData(currentId, relationsInput, record.owner_id);
      }

      return record;
    },
    onSuccess: (savedResident) => {
      //  住民キャッシュを無効化
      void queryClient.invalidateQueries({ queryKey: KEY });

      // 関連テーブルのキャッシュも無効化
      void queryClient.invalidateQueries({ queryKey: ['relations'] });
      void queryClient.invalidateQueries({ queryKey: ['feelings'] });
      void queryClient.invalidateQueries({ queryKey: ['nicknames'] });
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
