// packages/shared/logic/conversation-structure.ts
// 会話構造の決定: 主導権、感情スタンス、温度感、ターンバランス

import type {
  Traits,
  EmotionalStance,
  ConversationTemperature,
  ConversationStructure,
  SelectedTopic,
} from "@repo/shared/types/conversation-generation";

import type { CharacterContext, RelationContext } from "./topic-selection";

// ---------------------------------------------------------------------------
// 主導権（Dominance）
// ---------------------------------------------------------------------------

/**
 * 性格パラメータから主導性スコアを算出
 * スコアが高い方が会話の主導者になる
 */
export function dominanceScore(traits: Partial<Traits>): number {
  const s = traits.sociability ?? 3;
  const a = traits.activity ?? 3;
  const e = traits.expressiveness ?? 3;
  const st = traits.stubbornness ?? 3;
  return s * 0.35 + a * 0.3 + e * 0.25 + st * 0.1;
}

/**
 * 2キャラの主導者・追随者を決定する
 * 話題提供者（continuation/snippet等で特定のキャラが起点）がいればそちらを優先
 */
export function determineInitiator(
  charA: CharacterContext,
  charB: CharacterContext,
  topic: SelectedTopic,
): { initiator: CharacterContext; responder: CharacterContext } {
  // third_party話題の場合、知識を持っている側が主導
  if (topic.source === "third_party" && topic.thirdPartyContext) {
    // thirdPartyContextが存在する＝主導者がこの知識を持っている
    // 候補生成時にinitiatorの知識から作っているので、
    // この段階ではAが主導者の想定だが、dominanceスコアで最終判定
  }

  // personal_interest の場合、その興味を持っている側が主導
  if (topic.source === "personal_interest") {
    const aHas = charA.interests.includes(topic.label);
    const bHas = charB.interests.includes(topic.label);
    if (aHas && !bHas) return { initiator: charA, responder: charB };
    if (bHas && !aHas) return { initiator: charB, responder: charA };
  }

  // デフォルト: dominance スコアで判定
  const scoreA = dominanceScore(charA.traits);
  const scoreB = dominanceScore(charB.traits);

  // 僅差（0.5以内）なら対等。軽いランダム要素で決める
  if (Math.abs(scoreA - scoreB) < 0.5) {
    // 決定論的にするためIDの辞書順で決定（テスト容易性のため）
    return charA.id < charB.id
      ? { initiator: charA, responder: charB }
      : { initiator: charB, responder: charA };
  }

  return scoreA >= scoreB
    ? { initiator: charA, responder: charB }
    : { initiator: charB, responder: charA };
}

// ---------------------------------------------------------------------------
// 感情スタンス
// ---------------------------------------------------------------------------

/**
 * キャラの今回の会話での態度を決定
 * 性格 + 関係性 + 話題への関心度 から推定
 */
export function determineStance(
  character: CharacterContext,
  isInitiator: boolean,
  relation: RelationContext,
  topic: SelectedTopic,
  /** このキャラが話題に興味があるか */
  topicInterest: boolean,
  /** 相手に対する好感度スコア (0-100) */
  favorScore: number,
): EmotionalStance {
  const sociability = character.traits.sociability ?? 3;
  const empathy = character.traits.empathy ?? 3;
  const stubbornness = character.traits.stubbornness ?? 3;
  const expressiveness = character.traits.expressiveness ?? 3;

  // --- 話題関心度によるfavor減衰 (A-9) ---
  // 話題に関心がない場合、好感度のスタンスへの寄与を×0.5に減衰
  const effectiveFavorScore = topicInterest ? favorScore : favorScore * 0.5;

  // 基本スコアマップ: 各スタンスへの傾きを算出
  const scores: Record<EmotionalStance, number> = {
    enthusiastic: 0,
    agreeable: 0,
    reluctant: 0,
    indifferent: 0,
    confrontational: 0,
  };

  // --- 話題への興味 ---
  if (topicInterest) {
    scores.enthusiastic += 3;
    scores.agreeable += 1;
  } else {
    scores.indifferent += 2;
    scores.reluctant += 1;
  }

  // --- 性格の影響 ---
  // expressiveness高 + 興味あり → enthusiastic
  if (expressiveness >= 4 && topicInterest) scores.enthusiastic += 2;
  // expressiveness低 → indifferentやreluctant寄り
  if (expressiveness <= 2) {
    scores.indifferent += 1;
    scores.enthusiastic -= 1;
  }

  // empathy高 + 好感度高 → agreeable
  if (empathy >= 4 && effectiveFavorScore >= 50) scores.agreeable += 2;
  // empathy低 → confrontational方向の閾値が下がる
  if (empathy <= 2) scores.confrontational += 1;

  // stubbornness高 + 好感度低 → confrontational
  if (stubbornness >= 4 && effectiveFavorScore < 40) scores.confrontational += 2;
  // stubbornness低 → agreeable
  if (stubbornness <= 2) scores.agreeable += 1;

  // sociability低 + 興味なし → indifferent
  if (sociability <= 2 && !topicInterest) scores.indifferent += 2;
  // sociability高 → enthusiasticかagreeable方向
  if (sociability >= 4) {
    scores.enthusiastic += 1;
    scores.agreeable += 1;
  }

  // --- 関係性の影響 ---
  if (effectiveFavorScore >= 60) {
    scores.enthusiastic += 1;
    scores.agreeable += 1;
  } else if (effectiveFavorScore <= 25) {
    scores.reluctant += 1;
    scores.confrontational += 1;
  }

  // --- 主導者は積極的寄り ---
  if (isInitiator) {
    scores.enthusiastic += 1;
    scores.indifferent -= 1;
  }

  // 最高スコアのスタンスを採用
  let best: EmotionalStance = "agreeable";
  let bestScore = -Infinity;
  for (const [stance, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = stance as EmotionalStance;
    }
  }

  // --- 日常ノイズ: 25%の確率でスタンスを中立(agreeable)方向に1段階シフト ---
  if (Math.random() < 0.25 && best !== "agreeable") {
    const towardNeutral: Record<EmotionalStance, EmotionalStance> = {
      enthusiastic: "agreeable",
      confrontational: "reluctant",
      reluctant: "indifferent",
      indifferent: "agreeable",
      agreeable: "agreeable",
    };
    best = towardNeutral[best];
  }

  return best;
}

// ---------------------------------------------------------------------------
// 温度感
// ---------------------------------------------------------------------------

/**
 * 双方のスタンス + 関係性 から会話全体の温度感を決定
 */
export function determineTemperature(
  initiatorStance: EmotionalStance,
  responderStance: EmotionalStance,
  relationType: string,
): ConversationTemperature {
  // confrontational がいれば tense
  if (initiatorStance === "confrontational" || responderStance === "confrontational") {
    return "tense";
  }

  // 両方とも積極的 + 親しい関係 → warm
  const positiveStances: EmotionalStance[] = ["enthusiastic", "agreeable"];
  const bothPositive = positiveStances.includes(initiatorStance)
    && positiveStances.includes(responderStance);

  const closeRelations = ["friend", "best_friend", "lover", "family"];
  if (bothPositive && closeRelations.includes(relationType)) {
    return "warm";
  }

  // reluctant や indifferent がいる → lukewarm
  const passiveStances: EmotionalStance[] = ["reluctant", "indifferent"];
  if (passiveStances.includes(initiatorStance) || passiveStances.includes(responderStance)) {
    return "lukewarm";
  }

  // 両方とも穏やかだが深い関係ではない
  if (bothPositive) {
    return "neutral";
  }

  return "neutral";
}

// ---------------------------------------------------------------------------
// ターンバランス
// ---------------------------------------------------------------------------

/**
 * スタンスから発話の長さ目安を決定
 */
function turnLength(stance: EmotionalStance, isInitiator: boolean): string {
  switch (stance) {
    case "enthusiastic":
      return isInitiator ? "1〜2文" : "1〜2文";
    case "agreeable":
      return isInitiator ? "1〜2文" : "1文";
    case "reluctant":
      return isInitiator ? "1文" : "1文以内";
    case "indifferent":
      return "1文以内";
    case "confrontational":
      return "1〜2文";
    default:
      return "1文";
  }
}

// ---------------------------------------------------------------------------
// メインロジック
// ---------------------------------------------------------------------------

export type StructureInput = {
  characterA: CharacterContext;
  characterB: CharacterContext;
  relation: RelationContext;
  topic: SelectedTopic;
  initiatorOverrideId?: string;
};

/**
 * 会話構造を確定的に決定する
 */
export function buildConversationStructure(
  input: StructureInput,
): ConversationStructure {
  const { characterA, characterB, relation, topic, initiatorOverrideId } = input;

  // 1. 主導者・追随者の決定
  const { initiator, responder } = initiatorOverrideId === characterA.id
    ? { initiator: characterA, responder: characterB }
    : initiatorOverrideId === characterB.id
      ? { initiator: characterB, responder: characterA }
      : determineInitiator(characterA, characterB, topic);

  // 2. 話題への興味判定
  const initiatorTopicInterest = hasTopicInterest(initiator, topic);
  const responderTopicInterest = hasTopicInterest(responder, topic);

  // 3. 好感度スコアの取得
  const initiatorFavor = initiator === characterA
    ? relation.feelingAtoB.score
    : relation.feelingBtoA.score;
  const responderFavor = responder === characterA
    ? relation.feelingAtoB.score
    : relation.feelingBtoA.score;

  // 4. 感情スタンスの決定
  const initiatorStance = determineStance(
    initiator, true, relation, topic, initiatorTopicInterest, initiatorFavor,
  );
  const responderStance = determineStance(
    responder, false, relation, topic, responderTopicInterest, responderFavor,
  );

  // 5. 温度感の決定
  const temperature = determineTemperature(initiatorStance, responderStance, relation.type);

  // 6. ターンバランスの決定
  const initiatorTurnLength = turnLength(initiatorStance, true);
  const responderTurnLength = turnLength(responderStance, false);

  return {
    initiatorId: initiator.id,
    initiatorName: initiator.name,
    responderId: responder.id,
    responderName: responder.name,
    initiatorStance,
    responderStance,
    temperature,
    initiatorTurnLength,
    responderTurnLength,
  };
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

/**
 * キャラクターが話題に興味を持っているかを判定
 */
function hasTopicInterest(
  character: CharacterContext,
  topic: SelectedTopic,
): boolean {
  switch (topic.source) {
    case "shared_interest":
      // 共通興味 → 両者とも興味あり
      return true;
    case "personal_interest":
      // 個人興味 → 興味を持っている側は true
      return character.interests.includes(topic.label);
    case "continuation":
      // 前回の続き → 両者とも関心あり想定
      return true;
    case "snippet":
      // 共有した出来事 → 両者とも関心あり
      return true;
    case "third_party":
      // 第三者話題 → 知識を持っている側は興味あり
      return true;
    case "self_experience":
      // 自分の最近の出来事 → 話す側は関心あり
      return true;
    case "heart_to_heart":
      // 自己開示・質問 → 両者とも関心あり
      return true;
    case "small_talk":
      // 世間話 → 基本的に興味薄（フォールバック）
      return false;
    case "seasonal":
      // 季節・時事 → 基本的に興味薄
      return false;
  }
}
