// apps/web/lib/evaluation/evaluate-conversation.ts
// ------------------------------------------------------------
// GPT応答（会話）をローカルで評価し、Δ値・印象・スレッド進行・Belief更新を決定する。
// 数値の最終決定はローカルでのみ行い、GPTには一切させない方針。
// ------------------------------------------------------------

import {
  TagWeights,
  QualityWeights,
  SignalWeights,
  nextImpression,
  clipFavor,
  Impression,
} from './weights';

// ---- 入出力の型定義 ----------------------------------------------------------
// 既存の shared/gpt/schemas/conversation-output.ts に沿った最小限の受け口。
// 必要に応じてプロジェクトの型へ合わせて調整してください。

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
  // 直前の印象（未指定なら 'none' 扱い）
  currentImpression?: { aToB: Impression; bToA: Impression };
};

export type EvalOutput = {
  deltas: {
    aToB: { favor: number; impression: Impression };
    bToA: { favor: number; impression: Impression };
  };
  newBeliefs: { target: string; key: string }[];
  threadNextState: 'ongoing' | 'paused' | 'done';
  // ログモーダル末尾に表示するSYSTEM行（簡約サマリ）
  systemLine: string;
};

// ---- 実装本体 ---------------------------------------------------------------

export function evaluateConversation(input: EvalInput): EvalOutput {
  const { participants, lines } = input;
  const meta = input.meta ?? {};
  const [A, B] = participants;

  // 1) タグ重み集計（方向A→B/B→Aに等配）
  let a2bFavor = 0;
  let b2aFavor = 0;
  const tags = meta.tags ?? [];
  for (const t of tags) {
    const w = TagWeights[t] ?? 0;
    a2bFavor += w;
    b2aFavor += w;
  }

  // 2) 会話バランス（均衡なら微加点） ※偏りは0〜1
  const speakCountA = lines.filter((l) => l.speaker === A).length;
  const speakCountB = lines.filter((l) => l.speaker === B).length;
  const total = Math.max(1, speakCountA + speakCountB);
  const balance = Math.abs(speakCountA - speakCountB) / total;
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
  const threadNextState: EvalOutput['threadNextState'] =
    threadScore >= 0.2 ? 'done' : threadScore > 0 ? 'ongoing' : 'paused';

  // 5) Belief更新パッチ
  const newBeliefs = (meta.newKnowledge ?? []).map((x) => ({ target: x.target, key: x.key }));

  // 6) クリップと印象1段階制限
  a2bFavor = clipFavor(a2bFavor);
  b2aFavor = clipFavor(b2aFavor);

  const prevA2B = input.currentImpression?.aToB ?? 'none';
  const prevB2A = input.currentImpression?.bToA ?? 'none';
  const nextA2B = nextImpression(prevA2B, Math.sign(a2bFavor));
  const nextB2A = nextImpression(prevB2A, Math.sign(b2aFavor));

  // 7) SYSTEM 行（UI用サマリ）
  const systemBits: string[] = [];
  if (a2bFavor !== 0) systemBits.push(`${A}→${B} 好感度: ${a2bFavor > 0 ? '↑' : '↓'}`);
  if (b2aFavor !== 0) systemBits.push(`${B}→${A} 好感度: ${b2aFavor > 0 ? '↑' : '↓'}`);
  if (nextA2B !== prevA2B) systemBits.push(`${A}→${B} 印象: ${prevA2B}→${nextA2B}`);
  if (nextB2A !== prevB2A) systemBits.push(`${B}→${A} 印象: ${prevB2A}→${nextB2A}`);
  if (newBeliefs.length) systemBits.push(`Belief更新: ${newBeliefs.length}件`);
  const systemLine = systemBits.length ? `SYSTEM: ${systemBits.join(' / ')}` : '';

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

// ------------------------------------------------------------
// 補足：将来拡張
// - 特別関係（恋人/親友/家族）時の印象ラダー分岐：nextImpression() に関係コンテキストを渡す。
// - 話者起点でタグ寄与を変える：タグごとの「攻撃/防御」差別化や、発話の宛先推定を追加。
// - デバッグトレース：systemLine に [tags:+1.3][balance:+0.1] などを付加（本番OFF）。
// ------------------------------------------------------------
