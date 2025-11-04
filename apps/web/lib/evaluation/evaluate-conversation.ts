// apps/web/lib/evaluation/evaluate-conversation.ts

// ★ 問題1の修正: import文を正しく記述する
import type { GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import type { BeliefRecord, TopicThread, } from "@repo/shared/types/conversation";
import { defaultWeightTable, type WeightTable } from "./weight-table";

export type EvaluationResult = {
  deltas: {
    aToB: { favor: number; impression: number };
    bToA: { favor: number; impression: number };
  };
  newBeliefs: Record<string, BeliefRecord>;
  systemLine: string; // ★ 1. systemLine を型定義に追加
  threadNextState: TopicThread["status"] | undefined; // ★ 2. これを追加
};

/**
 * ★ 2. systemLine を構築するヘルパー関数を追加
 * (persist-conversation.ts からロジックを移動)
 */
function _buildSystemLine(
  participants: [string, string],
  deltas: EvaluationResult["deltas"],
): string {
  const [a, b] = participants;
  const fmt = (x: number) => (x > 0 ? `+${x}` : `${x}`);
  // evaluate-conversation 内では impression は number 型なので、impArrow は正しく動作します
  const impArrow = (x: number) => (x > 0 ? "↑" : x < 0 ? "↓" : "→");
  return `SYSTEM: ${a}→${b} 好感度 ${fmt(deltas.aToB.favor)} / 印象 ${impArrow(
    deltas.aToB.impression,
  )} | ${b}→${a} 好感度 ${fmt(deltas.bToA.favor)} / 印象 ${impArrow(deltas.bToA.impression)}`;
}

/**
 * GPT出力を基に好感度／印象変化とBelief更新を算出する
 */
export function evaluateConversation(params: {
  gptOut: GptConversationOutput;
  beliefs: Record<string, BeliefRecord>;
  weights?: WeightTable;
}): EvaluationResult {
  const { gptOut: output, beliefs } = params;
  const weights = params.weights ?? defaultWeightTable;
  const [a, b] = output.participants;
  const now = new Date().toISOString();

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
    const learnerId = target; // GPT meta.newKnowledge の target は “知識を得る人物” と解釈
    const aboutId = a === learnerId ? b : a; // 相手（知識の対象）
    const rec = newBeliefs[learnerId];
    if (!rec) continue;


    if (!rec.personKnowledge[aboutId]) {
      rec.personKnowledge[aboutId] = { keys: [], learnedAt: now };
    }
    const ks = rec.personKnowledge[aboutId].keys;
    if (!ks.includes(key)) ks.push(key);
    rec.personKnowledge[aboutId].learnedAt = now;
    rec.updated_at = now;
  }


    const systemLine = _buildSystemLine(output.participants, deltas);
    let threadNextState: TopicThread["status"] | undefined = undefined;
    const signal = output.meta.signals?.[0]; // GPTからのシグナルを取得
    if (signal === "close") {
      threadNextState = "done";
    } else if (signal === "park") {
      threadNextState = "paused";
    } else if (signal === "continue") {
      threadNextState = "ongoing";
    }

    return { deltas, newBeliefs, systemLine, threadNextState };
  }