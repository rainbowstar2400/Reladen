// apps/web/lib/evaluation/evaluate-conversation.ts
// ------------------------------------------------------------
// GPT応答（会話）をローカルで評価し、Δ値・印象・スレッド進行・Belief更新を決定。
// 数値の最終決定はローカルのみで行う（GPTに決めさせない）。
// ------------------------------------------------------------

import {
  TagWeights,
  QualityWeights,
  SignalWeights,
  nextImpression,
  clipFavor,
  Impression,
} from './weights';

// === 入力/出力 型定義 =========================================================

export type EvalInput = {
  threadId: string;
  participants: [string, string]; // [A, B]
  lines: { speaker: string; text: string }[];
  meta?: {
    tags?: string[];
    newKnowledge?: { target: string; key: string }[];
    signals?: ('continue' | 'close' | 'park')[];
    qualityHints?: Record<string, unknown>;
  };
  // 直前の印象（未指定なら 'none'）
  currentImpression?: { aToB: Impression; bToA: Impression };
};

// persist 側から参照される公開型
export type EvaluationResult = {
  deltas: {
    aToB: { favor: number; impression: Impression };
    bToA: { favor: number; impression: Impression };
  };
  newBeliefs: { target: string; key: string }[];
  threadNextState: 'ongoing' | 'paused' | 'done';
  // ログモーダル末尾に表示する SYSTEM 行（簡約サマリ）
  systemLine: string;
};

// === 実装本体 ================================================================

export function evaluateConversation(input: EvalInput): EvaluationResult {
  const { participants, lines } = input;
  const meta = input.meta ?? {};
  const [A, B] = participants;

  // 1) タグ重み集計（A→B/B→Aに等配）
  let a2bFavor = 0;
  let b2aFavor = 0;
  const tags = meta.tags ?? [];
  for (const t of tags) {
    const w = TagWeights[t] ?? 0;
    a2bFavor += w;
    b2aFavor += w;
  }

  // 2) 会話バランス（均衡なら微加点）
  const speakCountA = lines.filter((l) => l.speaker === A).length;
  const speakCountB = lines.filter((l) => l.speaker === B).length;
  const total = Math.max(1, speakCountA + speakCountB);
  const balance = Math.abs(speakCountA - speakCountB) / total; // 0=均衡, 1=偏り大
  const balanceGain = (1 - balance) * 0.2;
  a2bFavor += balanceGain;
  b2aFavor += balanceGain;

  // 3) qualityHints（キー出現で寄与）
  const qh = meta.qualityHints ?? {};
  for (const k of Object.keys(qh)) {
    const w = QualityWeights[k];
    if (typeof w === 'number') {
      a2bFavor += w;
      b2aFavor += w;
    }
  }

  // 4) signals（スレッド進行推定）
  const sigs = meta.signals ?? [];
  let threadScore = 0;
  for (const s of sigs) threadScore += SignalWeights[s] ?? 0;
  const threadNextState: EvaluationResult['threadNextState'] =
    threadScore >= 0.2 ? 'done' : threadScore > 0 ? 'ongoing' : 'paused';

  // 5) Belief 更新パッチ
  const newBeliefs = (meta.newKnowledge ?? []).map((x) => ({ target: x.target, key: x.key }));

  // 6) クリップと印象1段階制限
  a2bFavor = clipFavor(a2bFavor);
  b2aFavor = clipFavor(b2aFavor);

  const prevA2B = input.currentImpression?.aToB ?? 'none';
  const prevB2A = input.currentImpression?.bToA ?? 'none';
  const nextA2B = nextImpression(prevA2B, Math.sign(a2bFavor));
  const nextB2A = nextImpression(prevB2A, Math.sign(b2aFavor));

  // 7) SYSTEM 行（UI用サマリ）
  const bits: string[] = [];
  if (a2bFavor !== 0) bits.push(`${A}→${B} 好感度: ${a2bFavor > 0 ? '↑' : '↓'}`);
  if (b2aFavor !== 0) bits.push(`${B}→${A} 好感度: ${b2aFavor > 0 ? '↑' : '↓'}`);
  if (nextA2B !== prevA2B) bits.push(`${A}→${B} 印象: ${prevA2B}→${nextA2B}`);
  if (nextB2A !== prevB2A) bits.push(`${B}→${A} 印象: ${prevB2A}→${nextB2A}`);
  if (newBeliefs.length) bits.push(`Belief更新: ${newBeliefs.length}件`);
  const systemLine = bits.length ? `SYSTEM: ${bits.join(' / ')}` : '';

  return {
    deltas: {
      aToB: { favor: a2bFavor, impression: nextA2B },
      bToA: { favor: b2aFavor, impression: nextB2A },
    },
    newBeliefs,
    threadNextState,
    systemLine,
  };
}
