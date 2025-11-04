// apps/web/lib/evaluation/evaluate-conversation.ts

// ★ 問題1の修正: import文を正しく記述する
import type { GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import type { BeliefRecord } from "@repo/shared/types/conversation";
import { defaultWeightTable, type WeightTable } from "./weight-table";

export type EvaluationResult = {
  deltas: {
    aToB: { favor: number; impression: number };
    bToA: { favor: number; impression: number };
  };
  newBeliefs: Record<string, BeliefRecord>;
};

/**
 * GPT出力を基に好感度／印象変化とBelief更新を算出する
 */
export function evaluateConversation(params: {
  // ★ Vercel エラーの修正: 'output' を 'gptOut' に変更
  gptOut: GptConversationOutput; 
  beliefs: Record<string, BeliefRecord>;
  weights?: WeightTable;
}): EvaluationResult {
  // ★ 内部のロジックは変更しないよう、'gptOut' を 'output' という名前で受け取る
  const { gptOut: output, beliefs } = params; 
  const weights = params.weights ?? defaultWeightTable;
  const [a, b] = output.participants;

  let aFavor = 0;
  let bFavor = 0;
  let aImpression = 0;
  let bImpression = 0;

  // ---- タグ評価 ----
  for (const tag of output.meta.tags ?? []) {
    const w = weights.tags[tag] ?? 0;
    aFavor += w;
    bFavor += w * 0.9; // 双方向だが受け取り手を若干小さめに
  }

  // ---- 会話バランス／トーン補正 ----
  const q = output.meta.qualityHints;
  if (q?.turnBalance && weights.quality[q.turnBalance]) {
    aImpression += weights.quality[q.turnBalance];
    bImpression += weights.quality[q.turnBalance];
  }
  if (q?.tone && weights.quality.toneBonus[q.tone]) {
    aFavor += weights.quality.toneBonus[q.tone];
    bFavor += weights.quality.toneBonus[q.tone];
  }

  // ---- 正規化（クリップ ±2／印象±1）----
  const clip = (v: number, limit: number) =>
    Math.max(-limit, Math.min(limit, Number(v.toFixed(2))));

  const deltas = {
    aToB: {
      favor: clip(aFavor, 2),
      impression: clip(aImpression, 1),
    },
    bToA: {
      favor: clip(bFavor, 2),
      impression: clip(bImpression, 1),
    },
  };

  // ---- Belief更新 ----
  const newBeliefs: Record<string, BeliefRecord> = structuredClone(beliefs);
  for (const item of output.meta.newKnowledge ?? []) {
    const target = item.target;
    const key = item.key;
    const rec = newBeliefs[target];
    if (!rec) continue;

    if (!rec.personKnowledge[target]) {
      rec.personKnowledge[target] = { keys: [], learnedAt: new Date().toISOString() };
    }
    const existing = rec.personKnowledge[target].keys;
    if (!existing.includes(key)) existing.push(key);
    rec.personKnowledge[target].learnedAt = new Date().toISOString();
    rec.updated_at = new Date().toISOString();
  }

  return { deltas, newBeliefs };
}