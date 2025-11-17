// apps/web/lib/evaluation/evaluate-conversation.ts

import { getWeightsCached, nextImpression, clipFavor, Impression } from './weights';

// ------------------------------------------------------------
// GPT応答（会話）をローカルで評価し、Δ値・印象・スレッド進行・Belief更新を決定。
// 数値の最終決定はローカルのみで行う（GPTに決めさせない）。
// 依存なしで自己完結するよう、重みやユーティリティも本ファイル内に定義。
// ------------------------------------------------------------

/** 印象ラベル（1段階だけ変化させる） */

/** evaluateConversation の入力 */
export type EvalInput = {
  threadId: string;
  participants: [string, string]; // [A, B]
  lines: Array<{ speaker: string; text: string }>;
  meta?: {
    tags?: string[];
    newKnowledge?: Array<{ target: string; key: string }>;
    signals?: Array<'continue' | 'close' | 'park'>;
    qualityHints?: Record<string, unknown>;
  };
  // 直前の印象（未指定なら 'none'）
  currentImpression?: { aToB: Impression; bToA: Impression };
};

/** evaluateConversation の出力（persist 側が使う） */
export type EvaluationResult = {
  deltas: {
    aToB: { favor: number; impression: Impression };
    bToA: { favor: number; impression: Impression };
  };
  newBeliefs: Array<{ target: string; key: string }>;
  threadNextState: 'ongoing' | 'paused' | 'done';
  /** ログ表示用の簡易SYSTEM行 */
  systemLine: string;
};

// ===== デフォルト重み・ユーティリティ（外部 weights 未導入でも動くよう自己完結） =====
const TAG_WEIGHTS: Record<string, number> = {
  // ポジティブ
  '共感': 0.6,
  '感謝': 0.7,
  '称賛': 0.8,
  '協力': 0.5,
  // ネガティブ
  '否定': -0.8,
  '皮肉': -0.5,
  '非難': -1.2,
  // 中立/軽微
  '情報共有': 0.1,
  '軽い冗談': 0.2,
};

const QUALITY_WEIGHTS: Record<string, number> = {
  'coherence.good': 0.2,
  'coherence.poor': -0.4,
  'tone.gentle': 0.2,
  'tone.harsh': -0.4,
};

const SIGNAL_WEIGHTS: Record<'continue' | 'close' | 'park', number> = {
  continue: 0.1,
  close: 0.2,
  park: 0,
};

const FAVOR_CLIP = { min: -2, max: 2 } as const;
const IMPRESSION_ORDER: Impression[] = ['dislike', 'awkward', 'none', 'curious', 'like?', 'like'];

function nextImpression1step(current: Impression, deltaSign: number): Impression {
  if (deltaSign === 0) return current;
  const i = IMPRESSION_ORDER.indexOf(current);
  if (i < 0) return current;
  return deltaSign > 0
    ? IMPRESSION_ORDER[Math.min(i + 1, IMPRESSION_ORDER.length - 1)]
    : IMPRESSION_ORDER[Math.max(i - 1, 0)];
}

// ===== 本体 ===================================================================

export function evaluateConversation(input: EvalInput): EvaluationResult {
  const meta = input.meta ?? {};
  const [a, b] = input.participants;
  const now = new Date().toISOString(); // learnedAt などに使う場合はここから渡す

  // input.lines が null/undefined の場合、空配列 [] にフォールバックする
  const lines = Array.isArray(input.lines) ? input.lines : [];

  // 1) タグ重み集計（A→B / B→A 同加算。必要なら話者向きで差別化可能）
  let a2bFavor = 0;
  let b2aFavor = 0;
  const tags: string[] = meta.tags ?? [];
  for (const t of tags) {
    const w = TAG_WEIGHTS[t] ?? 0;
    a2bFavor += w;
    b2aFavor += w;
  }

  // 2) 会話バランス（均衡に微加点）
  // 安全な `lines` 変数を使う
  const speakCountA = lines.filter(
    (l: { speaker: string; text: string }) => l.speaker === a,
  ).length;
  const speakCountB = lines.filter(
    (l: { speaker: string; text: string }) => l.speaker === b,
  ).length;
  const total = Math.max(1, speakCountA + speakCountB);
  const balance = Math.abs(speakCountA - speakCountB) / total; // 0=均衡, 1=偏り
  const balanceGain = (1 - balance) * 0.2;
  a2bFavor += balanceGain;
  b2aFavor += balanceGain;

  // 3) qualityHints の寄与（キー出現で加減点）
  const qh = meta.qualityHints ?? {};
  for (const k of Object.keys(qh)) {
    const w = QUALITY_WEIGHTS[k];
    if (typeof w === 'number') {
      a2bFavor += w;
      b2aFavor += w;
    }
  }

  // 4) signals によるスレッド進行
  let threadScore = 0;
  const sigs: Array<'continue' | 'close' | 'park'> = (meta.signals ?? []) as Array<
    'continue' | 'close' | 'park'
  >;
  for (const s of sigs) {
    threadScore += SIGNAL_WEIGHTS[s] ?? 0;
  }
  const threadNextState: EvaluationResult['threadNextState'] =
    threadScore >= 0.2 ? 'done' : threadScore > 0 ? 'ongoing' : 'paused';

  // 5) Belief 更新パッチの作成
  // meta.newKnowledge: { target: 学習者ID, key: その学習者が覚えた知識キー }
  const newBeliefs: Array<{ target: string; key: string }> = [];
  const nkList: Array<{ target: string; key: string }> = meta.newKnowledge ?? [];
  for (const nk of nkList) {
    // nk 自体が null/undefined の場合、ループをスキップ
    if (!nk) continue;

    // これで安全にデストラクチャリングできる
    const { target, key } = nk;
    if (!target || !key) continue;

    newBeliefs.push({ target, key });
  }

  // 6) クリップと印象1段階制限
  a2bFavor = clipFavor(a2bFavor);
  b2aFavor = clipFavor(b2aFavor);
  const prevA2B: Impression = input.currentImpression?.aToB ?? 'none';
  const prevB2A: Impression = input.currentImpression?.bToA ?? 'none';
  const nextA2B: Impression = nextImpression1step(prevA2B, Math.sign(a2bFavor));
  const nextB2A: Impression = nextImpression1step(prevB2A, Math.sign(b2aFavor));

  // 7) SYSTEM 行（UI用サマリ）
  const bits: string[] = [];
  if (a2bFavor !== 0) bits.push(`${a}→${b} 好感度: ${a2bFavor > 0 ? '↑' : '↓'}`);
  if (b2aFavor !== 0) bits.push(`${b}→${a} 好感度: ${b2aFavor > 0 ? '↑' : '↓'}`);
  if (nextA2B !== prevA2B) bits.push(`${a}→${b} 印象: ${prevA2B}→${nextA2B}`);
  if (nextB2A !== prevB2A) bits.push(`${b}→${a} 印象: ${prevB2A}→${nextB2A}`);
  if (newBeliefs.length) bits.push(`Belief更新: ${newBeliefs.length}件`);
  const systemLine = bits.length ? `SYSTEM: ${bits.join(' / ')}` : '';

  // 8) 最終 return（必ず到達）
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
