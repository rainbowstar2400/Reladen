// packages/shared/logic/snippet-generator.ts
// 共有スニペット生成（組み合わせ方式）
//
// 会話とは独立した定期バッチで生成する。
// テンプレート全文ではなく、場所×状況×修飾語のパーツを組み合わせてバリエーションを出す。

import type { SharedSnippet, SnippetSource } from "@repo/shared/types/conversation-generation";

// ---------------------------------------------------------------------------
// パーツ定義
// ---------------------------------------------------------------------------

export const PLACES = [
  "商店街", "駅前", "コンビニ", "公園", "カフェ",
  "図書館", "スーパー", "川沿い", "バス停", "本屋",
  "パン屋", "花屋の前", "階段の踊り場", "自販機の前", "ベンチ",
] as const;

export const SITUATIONS = [
  "偶然すれ違った",
  "隣の席になった",
  "一緒に帰ることになった",
  "同じものを見ていた",
  "同時に入店した",
  "レジで前後になった",
  "同じベンチに座った",
  "雨宿りしていた",
  "道を譲り合った",
  "荷物を落としたところを助けた",
  "同じ電車を待っていた",
  "隣で信号待ちをしていた",
  "同じ本を手に取ろうとした",
  "同じメニューを注文した",
  "休憩中に目が合った",
] as const;

export const MODIFIERS = [
  "たまたま",
  "久しぶりに",
  "いつもの",
  "朝早くに",
  "夕方に",
  "帰り道で",
  "買い物中に",
  "散歩中に",
  "ふと",
  "何気なく",
] as const;

// ---------------------------------------------------------------------------
// 場所×状況の相性ルール
// ---------------------------------------------------------------------------

/** 場所ごとに有効な状況のインデックス。未定義の場所はすべての状況を許容 */
const PLACE_SITUATION_COMPAT: Partial<Record<string, number[]>> = {
  "商店街":     [0, 3, 4, 5, 8, 11],
  "駅前":       [0, 10, 11, 14],
  "コンビニ":    [0, 4, 5, 8],
  "公園":       [0, 6, 7, 14],
  "カフェ":      [1, 4, 13, 14],
  "図書館":     [1, 3, 12, 14],
  "スーパー":    [0, 3, 4, 5, 8],
  "川沿い":      [0, 6, 7, 14],
  "バス停":      [0, 10, 11],
  "本屋":       [0, 3, 12],
  "パン屋":      [0, 4, 5, 13],
  "花屋の前":    [0, 3, 8, 11],
  "自販機の前":   [0, 8, 14],
  "ベンチ":      [0, 6, 7, 14],
};

// ---------------------------------------------------------------------------
// ソース決定
// ---------------------------------------------------------------------------

/** 状況キーワードからソースを推定 */
function inferSource(situation: string): SnippetSource {
  if (situation.includes("雨宿り") || situation.includes("信号") || situation.includes("電車")) {
    return "environment";
  }
  if (situation.includes("偶然") || situation.includes("同時") || situation.includes("同じ")) {
    return "coincidence";
  }
  return "routine";
}

// ---------------------------------------------------------------------------
// 関係性に基づく生成確率
// ---------------------------------------------------------------------------

const GENERATION_PROBABILITY: Record<string, number> = {
  none: 0,
  acquaintance: 0.1,
  friend: 0.3,
  best_friend: 0.5,
  lover: 0.6,
  family: 0.5,
};

// ---------------------------------------------------------------------------
// 乱数ヘルパー
// ---------------------------------------------------------------------------

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shouldGenerate(relationType: string): boolean {
  const prob = GENERATION_PROBABILITY[relationType] ?? 0;
  return Math.random() < prob;
}

// ---------------------------------------------------------------------------
// スニペット生成
// ---------------------------------------------------------------------------

export type SnippetGenerationInput = {
  participantA: string;
  participantB: string;
  relationType: string;
  /** 生成を強制する（確率判定をスキップ） */
  force?: boolean;
};

/**
 * ペアに対してスニペットを1件生成する（確率で生成しない場合もある）
 * @returns 生成されたスニペット、または null
 */
export function generateSnippet(
  input: SnippetGenerationInput,
): Omit<SharedSnippet, "id" | "occurredAt"> | null {
  if (!input.force && !shouldGenerate(input.relationType)) {
    return null;
  }

  const place = pickRandom(PLACES);
  const modifier = pickRandom(MODIFIERS);

  // 場所に適合する状況を選ぶ
  const compatIndexes = PLACE_SITUATION_COMPAT[place];
  let situation: string;
  if (compatIndexes && compatIndexes.length > 0) {
    const idx = pickRandom(compatIndexes);
    situation = SITUATIONS[idx] ?? pickRandom(SITUATIONS);
  } else {
    situation = pickRandom(SITUATIONS);
  }

  const source = inferSource(situation);
  const text = `${modifier}${place}で${situation}`;

  return {
    participants: [input.participantA, input.participantB],
    text,
    source,
  };
}

/**
 * 全ペアに対してスニペットをバッチ生成する
 */
export function generateSnippetsBatch(
  pairs: Array<{
    participantA: string;
    participantB: string;
    relationType: string;
  }>,
): Array<Omit<SharedSnippet, "id" | "occurredAt">> {
  const results: Array<Omit<SharedSnippet, "id" | "occurredAt">> = [];

  for (const pair of pairs) {
    const snippet = generateSnippet(pair);
    if (snippet) {
      results.push(snippet);
    }
  }

  return results;
}
