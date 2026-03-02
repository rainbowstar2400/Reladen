// packages/shared/logic/knowledge-propagation.ts
// オフスクリーン知識伝播ロジック
//
// キャラCの「最近の出来事」を、CとAの関係性＋Cの性格に基づいて
// Aの知識として伝播するかどうかを確率判定する。

import type {
  RecentEvent,
  OffscreenKnowledge,
  Traits,
} from "@repo/shared/types/conversation-v2";

// ---------------------------------------------------------------------------
// 入力型
// ---------------------------------------------------------------------------

export type PropagationCharacter = {
  id: string;
  name: string;
  traits: Partial<Traits>;
};

export type PropagationRelation = {
  fromId: string;
  toId: string;
  type: "none" | "acquaintance" | "friend" | "best_friend" | "lover" | "family";
};

export type PropagationInput = {
  /** 情報源キャラ（Cの出来事をAに伝播するか判定する場合、sourceはC） */
  source: PropagationCharacter;
  /** 受け手キャラ（A） */
  receiver: PropagationCharacter;
  /** source → receiver の関係性 */
  relation: PropagationRelation;
  /** 伝播候補の出来事 */
  event: RecentEvent;
};

// ---------------------------------------------------------------------------
// 関係性の親密度重み
// ---------------------------------------------------------------------------

const INTIMACY_WEIGHT: Record<string, number> = {
  none: 0,
  acquaintance: 0.15,
  friend: 0.45,
  best_friend: 0.7,
  lover: 0.8,
  family: 0.65,
};

// ---------------------------------------------------------------------------
// 伝播確率の算出
// ---------------------------------------------------------------------------

/**
 * 伝播確率を算出する (0.0 ~ 1.0)
 *
 * 決定要素:
 * - C（情報源）のsociability — 低いと話さないので伝播しにくい
 * - C（情報源）のexpressiveness — 低いと個人的な話は伝播しにくい
 * - AとCの関係性 — 親密なほど伝播しやすい
 */
export function propagationProbability(input: PropagationInput): number {
  const intimacy = INTIMACY_WEIGHT[input.relation.type] ?? 0;
  if (intimacy === 0) return 0;

  const sourceSociability = input.source.traits.sociability ?? 3;
  const sourceExpressiveness = input.source.traits.expressiveness ?? 3;

  // 各要素を 0-1 に正規化して重み付け
  const sociabilityFactor = (sourceSociability - 1) / 4; // 0.0 ~ 1.0
  const expressivenessFactor = (sourceExpressiveness - 1) / 4; // 0.0 ~ 1.0

  // 重み配分: 関係性 50%, sociability 30%, expressiveness 20%
  const probability =
    intimacy * 0.5 +
    sociabilityFactor * 0.3 +
    expressivenessFactor * 0.2;

  // 0-1にクランプ
  return Math.max(0, Math.min(1, probability));
}

/**
 * 伝播するかどうかを確率判定する
 */
export function shouldPropagate(input: PropagationInput): boolean {
  // すでに伝播済みならスキップ
  if (input.event.sharedWith.includes(input.receiver.id)) {
    return false;
  }
  const prob = propagationProbability(input);
  return Math.random() < prob;
}

// ---------------------------------------------------------------------------
// バッチ伝播
// ---------------------------------------------------------------------------

export type PropagationBatchInput = {
  /** 全キャラクターの情報 */
  characters: PropagationCharacter[];
  /** 全ペアの関係性 */
  relations: PropagationRelation[];
  /** 伝播候補の最近の出来事 */
  events: RecentEvent[];
};

export type PropagationResult = {
  /** 新しく生成される知識 */
  newKnowledge: Array<Omit<OffscreenKnowledge, "id" | "learnedAt">>;
  /** 伝播済みとしてマークするべき { eventId, receiverId } */
  propagated: Array<{ eventId: string; receiverId: string }>;
};

/**
 * 全イベントについて、各キャラへの伝播を判定する
 */
export function propagateKnowledgeBatch(
  input: PropagationBatchInput,
): PropagationResult {
  const charMap = new Map(input.characters.map((c) => [c.id, c]));

  // 関係性を高速検索用にマップ化
  // key: "fromId:toId" → relation
  const relationMap = new Map<string, PropagationRelation>();
  for (const rel of input.relations) {
    relationMap.set(`${rel.fromId}:${rel.toId}`, rel);
    // 双方向で使えるようにする（関係性は対称）
    relationMap.set(`${rel.toId}:${rel.fromId}`, {
      ...rel,
      fromId: rel.toId,
      toId: rel.fromId,
    });
  }

  const newKnowledge: PropagationResult["newKnowledge"] = [];
  const propagated: PropagationResult["propagated"] = [];

  for (const event of input.events) {
    const source = charMap.get(event.characterId);
    if (!source) continue;

    // 全キャラを候補として判定
    for (const receiver of input.characters) {
      // 自分自身には伝播しない
      if (receiver.id === source.id) continue;

      // 関係性を取得
      const relation = relationMap.get(`${source.id}:${receiver.id}`);
      if (!relation || relation.type === "none") continue;

      const shouldProp = shouldPropagate({
        source,
        receiver,
        relation,
        event,
      });

      if (shouldProp) {
        newKnowledge.push({
          learnedBy: receiver.id,
          about: source.id,
          fact: event.fact,
          source: "offscreen",
        });
        propagated.push({
          eventId: event.id,
          receiverId: receiver.id,
        });
      }
    }
  }

  return { newKnowledge, propagated };
}
