// packages/shared/logic/promise.ts
// 約束（promise）生成の確率算出
// 仕様: 04_会話生成系.md §4.7

export type PromiseDecisionInput = {
  relationType: string;
  topicSource: string;
  /** 主導者側の好感度 (0-100) */
  favorScore: number;
};

// --- 関係重み ---
const RELATION_WEIGHT: Record<string, number> = {
  none: 0,
  acquaintance: 0,
  friend: 1.0,
  family: 1.1,
  best_friend: 1.3,
  lover: 1.3,
};

// --- 話題重み ---
const TOPIC_WEIGHT: Record<string, number> = {
  shared_interest: 1.1,
  personal_interest: 1.0,
  snippet: 0.8,
  seasonal: 0.7,
  self_experience: 0.5,
  small_talk: 0.4,
  continuation: 0,
  third_party: 0,
  heart_to_heart: 0,
};

/**
 * 約束発生確率を算出し抽選する。
 *
 * P = 10% × 関係重み × 話題重み × favorModifier
 * favorModifier = 0.5 + (favor / 100)  → 0.5〜1.5
 * 実効レンジ: 約2〜17%
 *
 * @returns true なら約束生成会話にする
 */
export function shouldGeneratePromise(input: PromiseDecisionInput): boolean {
  const relationWeight = RELATION_WEIGHT[input.relationType] ?? 0;
  const topicWeight = TOPIC_WEIGHT[input.topicSource] ?? 0;

  if (relationWeight === 0 || topicWeight === 0) return false;

  const favorModifier = 0.5 + (input.favorScore / 100);
  const probability = 0.10 * relationWeight * topicWeight * favorModifier;

  return Math.random() < probability;
}

/** 会話タイプを決定する */
export type ConversationType = 'normal' | 'promise_generation' | 'promise_fulfillment';

export function determineConversationType(
  topicSource: string,
  promiseFlag: boolean,
): ConversationType {
  if (topicSource === 'continuation') return 'promise_fulfillment';
  if (promiseFlag) return 'promise_generation';
  return 'normal';
}
