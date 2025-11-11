import type { Resident } from '@/types';
import { calcSituation, type SleepProfile } from '../../../../packages/shared/logic/schedule';

export function selectConversationCandidates(now: Date, residents: Resident[]) {
  return residents.filter(r => {

    // ★ 変更:
    // `useResidents` が 'todaySchedule' を含む `sleepProfile` を
    // 準備している前提で `calcSituation` を呼ぶ。
    // `r.sleepProfile` が未設定 (undefined) の場合、`calcSituation` は
    // 安全に 'active' を返す設計になっている。
    const sit = calcSituation(now, (r.sleepProfile ?? {}) as SleepProfile);

    // ご要望の元々のロジック (sleeping 以外)
    return sit !== 'sleeping';
  });
}