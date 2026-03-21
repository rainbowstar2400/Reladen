// apps/web/lib/batch/daily-decay.ts
// 日次バッチ: 好感度自然減少 (A-6) + 印象時間回帰 (B-1) + awkward時間回復 (B-4)

import { listKV as listAny, putKV as putAny } from "@/lib/db/kv-server";
import { newId } from "@/lib/newId";

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

type FeelingRow = {
  id: string;
  from_id: string;
  to_id: string;
  label: string;
  base_label?: string;
  special_label?: string | null;
  base_before_special?: string | null;
  score: number;
  recent_deltas?: number[];
  last_contacted_at?: string;
  updated_at: string;
  deleted?: boolean;
  owner_id?: string;
  [key: string]: unknown;
};

type RelationRow = {
  a_id?: string;
  b_id?: string;
  type?: string;
  deleted?: boolean;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// 定数
// ---------------------------------------------------------------------------

const NEUTRAL_SCORE = 30;
const GRACE_DAYS_FAVOR = 3;
const GRACE_DAYS_IMPRESSION = 7;
const MS_PER_DAY = 86_400_000;

const SPECIAL_RELATIONS = new Set(['best_friend', 'lover', 'family']);
const FEELING_BASE_LABELS = new Set([
  'dislike',
  'maybe_dislike',
  'none',
  'curious',
  'maybe_like',
  'like',
  'love',
] as const);

type FeelingBaseLabel =
  | 'dislike'
  | 'maybe_dislike'
  | 'none'
  | 'curious'
  | 'maybe_like'
  | 'like'
  | 'love';

function normalizeBaseLabel(value: unknown, fallback: FeelingBaseLabel = 'none'): FeelingBaseLabel {
  if (typeof value === 'string' && FEELING_BASE_LABELS.has(value as FeelingBaseLabel)) {
    return value as FeelingBaseLabel;
  }
  return fallback;
}

function normalizeNullableBaseLabel(value: unknown): FeelingBaseLabel | null {
  if (typeof value !== 'string') return null;
  if (!FEELING_BASE_LABELS.has(value as FeelingBaseLabel)) return null;
  return value as FeelingBaseLabel;
}

// ---------------------------------------------------------------------------
// A-6: 好感度自然減少（中立点30への収束）
// ---------------------------------------------------------------------------

function decayFavor(score: number, daysElapsed: number): number {
  if (daysElapsed <= GRACE_DAYS_FAVOR) return score;

  const rate = daysElapsed <= 7 ? 1 : 2;

  if (score > NEUTRAL_SCORE) {
    return Math.max(NEUTRAL_SCORE, score - rate);
  }
  if (score < NEUTRAL_SCORE) {
    return Math.min(NEUTRAL_SCORE, score + rate);
  }
  return score;
}

// ---------------------------------------------------------------------------
// B-1: 印象時間回帰
// ---------------------------------------------------------------------------

const NORMAL_REGRESSION: Record<string, { target: string; probability: number }> = {
  'curious': { target: 'none', probability: 1.0 },
  'maybe_like': { target: 'curious', probability: 0.30 },
  'maybe_dislike': { target: 'none', probability: 0.25 },
};

const SPECIAL_REGRESSION: Record<string, { target: string; probability: number }> = {
  'love': { target: 'like', probability: 0.25 },
  'none': { target: 'like', probability: 0.25 },
  'dislike': { target: 'none', probability: 0.20 },
};

function regressImpression(
  label: string,
  daysElapsed: number,
  isSpecialRelation: boolean,
): string | null {
  if (daysElapsed <= GRACE_DAYS_IMPRESSION) return null;

  const table = isSpecialRelation ? SPECIAL_REGRESSION : NORMAL_REGRESSION;
  const entry = table[label];
  if (!entry) return null;

  if (Math.random() < entry.probability) {
    return entry.target;
  }
  return null;
}

// ---------------------------------------------------------------------------
// B-4: awkward 時間回復（7日猶予後25%/日）
// ---------------------------------------------------------------------------

function shouldClearAwkward(daysElapsed: number): boolean {
  if (daysElapsed <= GRACE_DAYS_IMPRESSION) return false;
  return Math.random() < 0.25;
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

export async function runDailyDecay(): Promise<{
  processed: number;
  updated: number;
  transitioned: number;
}> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // 全 feelings / relations を取得
  const feelings = (await listAny("feelings")) as unknown as FeelingRow[] | null;
  const relations = (await listAny("relations")) as unknown as RelationRow[] | null;

  if (!Array.isArray(feelings) || feelings.length === 0) {
    return { processed: 0, updated: 0, transitioned: 0 };
  }

  // ペアの関係タイプを引くヘルパー
  const relationMap = new Map<string, string>();
  if (Array.isArray(relations)) {
    for (const rel of relations) {
      if (!rel || rel.deleted || !rel.type) continue;
      const aId = rel.a_id ?? (rel as any).aId;
      const bId = rel.b_id ?? (rel as any).bId;
      if (aId && bId) {
        relationMap.set(`${aId}:${bId}`, rel.type);
        relationMap.set(`${bId}:${aId}`, rel.type);
      }
    }
  }

  let processed = 0;
  let updated = 0;
  let transitioned = 0;

  for (const feeling of feelings) {
    if (feeling.deleted) continue;
    processed++;

    const lastContact = feeling.last_contacted_at ?? feeling.updated_at;
    const lastContactMs = Date.parse(lastContact);
    if (!Number.isFinite(lastContactMs)) continue;

    const daysElapsed = Math.floor((now - lastContactMs) / MS_PER_DAY);
    if (daysElapsed <= GRACE_DAYS_FAVOR) continue; // 3日猶予内なら何もしない

    let changed = false;
    let newScore = feeling.score;
    let newBaseLabel = normalizeBaseLabel(
      feeling.base_label,
      normalizeBaseLabel(feeling.label, 'none'),
    );
    let newSpecialLabel: 'awkward' | null = feeling.special_label === 'awkward' || feeling.label === 'awkward'
      ? 'awkward'
      : null;
    let newBaseBeforeSpecial = normalizeNullableBaseLabel(feeling.base_before_special);
    let newLabel = newSpecialLabel === 'awkward' ? 'awkward' : newBaseLabel;

    // 関係タイプを取得
    const relType = relationMap.get(`${feeling.from_id}:${feeling.to_id}`) ?? 'acquaintance';
    const isSpecial = SPECIAL_RELATIONS.has(relType);

    // A-6: 好感度減少
    const decayed = decayFavor(feeling.score, daysElapsed);
    if (decayed !== feeling.score) {
      newScore = decayed;
      changed = true;
    }

    // B-4: awkward 回復
    if (newSpecialLabel === 'awkward' && shouldClearAwkward(daysElapsed)) {
      newBaseLabel = newBaseBeforeSpecial ?? newBaseLabel;
      newSpecialLabel = null;
      newBaseBeforeSpecial = null;
      newLabel = newBaseLabel;
      changed = true;
    }

    // B-1: 印象回帰（awkwardでない場合のみ）
    if (newSpecialLabel !== 'awkward') {
      const regressed = regressImpression(newBaseLabel, daysElapsed, isSpecial);
      if (regressed) {
        newBaseLabel = normalizeBaseLabel(regressed, newBaseLabel);
        newLabel = regressed;
        changed = true;
      }
    }

    if (changed) {
      await putAny("feelings", {
        ...feeling,
        score: newScore,
        label: newLabel,
        base_label: newBaseLabel,
        special_label: newSpecialLabel,
        base_before_special: newBaseBeforeSpecial,
        updated_at: nowIso,
      });
      updated++;
    }
  }

  // none → acquaintance 遷移（日次バッチで確率遷移）
  if (Array.isArray(relations)) {
    for (const rel of relations) {
      if (!rel || rel.deleted) continue;
      if (rel.type !== 'none') continue;

      // 5%の確率で遷移
      if (Math.random() < 0.05) {
        await putAny("relations", {
          ...rel,
          type: 'acquaintance',
          updated_at: nowIso,
        });

        const aId = rel.a_id ?? (rel as any).aId;
        const bId = rel.b_id ?? (rel as any).bId;

        // system イベント記録
        await putAny("events", {
          id: newId(),
          kind: "system",
          updated_at: nowIso,
          deleted: false,
          payload: {
            type: "relation_transition",
            subType: "became_acquaintance",
            participants: [aId, bId],
            from: "none",
            to: "acquaintance",
          },
        } as any);

        transitioned++;
      }
    }
  }

  return { processed, updated, transitioned };
}
