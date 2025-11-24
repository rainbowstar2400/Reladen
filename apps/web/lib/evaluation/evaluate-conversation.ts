// apps/web/lib/evaluation/evaluate-conversation.ts

import { getWeightsCached, nextImpression, clipFavor, Impression, ImpressionBase } from './weights';

// ------------------------------------------------------------
// GPT応答（会話イベント）をローカルで評価し、Δ値・印象・スレッド進行・Belief更新を決定
// ------------------------------------------------------------

export type ImpressionState = {
  base: ImpressionBase;
  special: 'awkward' | null;
  baseBeforeSpecial?: ImpressionBase | null;
};

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
    // special の付与/解除は明示フラグのみ
    impressionSpecial?: { setAwkward?: boolean; clearAwkward?: boolean };
  };
  // 直前の印象（旧: 単一ラベル, 新: state）
  currentImpression?: {
    aToB: Impression | ImpressionState;
    bToA: Impression | ImpressionState;
  };
};

/** evaluateConversation の出力（persist 側が使う） */
export type EvaluationResult = {
  deltas: {
    aToB: { favor: number; impression: Impression; impressionState: ImpressionState };
    bToA: { favor: number; impression: Impression; impressionState: ImpressionState };
  };
  newBeliefs: Array<{ target: string; key: string }>;
  threadNextState: 'ongoing' | 'paused' | 'done';
  /** ログ表示用の簡易SYSTEM行 */
  systemLine: string;
};

// ===== デフォルト重み・ユーティリティ（外部 weights 未導入でも動く） =====
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
  '雑談・共通': 0.1,
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
const IMPRESSION_ORDER: Impression[] = ['dislike', 'maybe_dislike', 'none', 'curious', 'maybe_like', 'like'];

function nextImpression1step(current: Impression, deltaSign: number): Impression {
  if (deltaSign === 0) return current;
  const i = IMPRESSION_ORDER.indexOf(current);
  if (i < 0) return current;
  return deltaSign > 0
    ? IMPRESSION_ORDER[Math.min(i + 1, IMPRESSION_ORDER.length - 1)]
    : IMPRESSION_ORDER[Math.max(i - 1, 0)];
}

function toState(input: Impression | ImpressionState | undefined, fallback: ImpressionBase): ImpressionState {
  if (!input) return { base: fallback, special: null, baseBeforeSpecial: null };
  if (typeof input === 'string') return { base: input as ImpressionBase, special: null, baseBeforeSpecial: null };
  return {
    base: (input as any).base as ImpressionBase,
    special: (input as any).special ?? null,
    baseBeforeSpecial: (input as any).baseBeforeSpecial ?? null,
  };
}

// ===== 本体 ===============================================================

export function evaluateConversation(input: EvalInput): EvaluationResult {
  const meta = input.meta ?? {};
  const [a, b] = input.participants;
  const now = new Date().toISOString(); // learnedAt などに使う場合ここから渡す

  // input.lines が null/undefined の場合、空配列 [] にフォールバックする
  const lines = Array.isArray(input.lines) ? input.lines : [];

  // 1) タグ重み加算。A→B / B→A 同加算。必要なら話者別で差別化可能
  let a2bFavor = 0;
  let b2aFavor = 0;
  const tags: string[] = meta.tags ?? [];
  for (const t of tags) {
    const w = TAG_WEIGHTS[t] ?? 0;
    a2bFavor += w;
    b2aFavor += w;
  }

  // 2) 会話バランス（均衡に微加点）
  const speakCountA = lines.filter((l) => l.speaker === a).length;
  const speakCountB = lines.filter((l) => l.speaker === b).length;
  const total = Math.max(1, speakCountA + speakCountB);
  const balance = Math.abs(speakCountA - speakCountB) / total; // 0=均衡, 1=偏り
  const balanceGain = (1 - balance) * 0.2;
  a2bFavor += balanceGain;
  b2aFavor += balanceGain;

  // 3) qualityHints の重み（キー出現で加減点）
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
  const sigs: Array<'continue' | 'close' | 'park'> = (meta.signals ?? []) as Array<'continue' | 'close' | 'park'>;
  for (const s of sigs) {
    threadScore += SIGNAL_WEIGHTS[s] ?? 0;
  }
  const threadNextState: EvaluationResult['threadNextState'] =
    threadScore >= 0.2 ? 'done' : threadScore > 0 ? 'ongoing' : 'paused';

  // 5) Belief 更新パッチを作成
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

  // 6) クリップと印象1段階制御
  a2bFavor = clipFavor(a2bFavor);
  b2aFavor = clipFavor(b2aFavor);

  const prevStateA2B = toState(input.currentImpression?.aToB as any, 'none');
  const prevStateB2A = toState(input.currentImpression?.bToA as any, 'none');

  // 変化量は +1 以上で上昇、-1 以下で下降、その他は据え置き
  const deltaSignA2B = a2bFavor >= 1 ? 1 : a2bFavor <= -1 ? -1 : 0;
  const deltaSignB2A = b2aFavor >= 1 ? 1 : b2aFavor <= -1 ? -1 : 0;
  let nextBaseA2B: ImpressionBase = nextImpression1step(prevStateA2B.base, deltaSignA2B);
  let nextBaseB2A: ImpressionBase = nextImpression1step(prevStateB2A.base, deltaSignB2A);

  const flags = meta.impressionSpecial ?? {};
  let nextSpecialA2B: 'awkward' | null = prevStateA2B.special ?? null;
  let nextSpecialB2A: 'awkward' | null = prevStateB2A.special ?? null;
  let baseBeforeSpecialA2B: ImpressionBase | null = prevStateA2B.baseBeforeSpecial ?? null;
  let baseBeforeSpecialB2A: ImpressionBase | null = prevStateB2A.baseBeforeSpecial ?? null;

  // 付与（明示フラグのみ）
  if (flags.setAwkward) {
    nextSpecialA2B = 'awkward';
    nextSpecialB2A = 'awkward';
    if (!baseBeforeSpecialA2B) baseBeforeSpecialA2B = nextBaseA2B;
    if (!baseBeforeSpecialB2A) baseBeforeSpecialB2A = nextBaseB2A;
  }

  // 解除（明示フラグ）
  if (flags.clearAwkward) {
    nextBaseA2B = baseBeforeSpecialA2B ?? nextBaseA2B;
    nextBaseB2A = baseBeforeSpecialB2A ?? nextBaseB2A;
    nextSpecialA2B = null;
    nextSpecialB2A = null;
    baseBeforeSpecialA2B = null;
    baseBeforeSpecialB2A = null;
  }

  // 自然解除（25%）
  if (!flags.setAwkward && !flags.clearAwkward) {
    const shouldClear = () => Math.random() < 0.25;
    if (nextSpecialA2B === 'awkward' && shouldClear()) {
      nextBaseA2B = baseBeforeSpecialA2B ?? nextBaseA2B;
      nextSpecialA2B = null;
      baseBeforeSpecialA2B = null;
    }
    if (nextSpecialB2A === 'awkward' && shouldClear()) {
      nextBaseB2A = baseBeforeSpecialB2A ?? nextBaseB2A;
      nextSpecialB2A = null;
      baseBeforeSpecialB2A = null;
    }
  }

  const nextStateA2B: ImpressionState = {
    base: nextBaseA2B,
    special: nextSpecialA2B,
    baseBeforeSpecial: baseBeforeSpecialA2B,
  };
  const nextStateB2A: ImpressionState = {
    base: nextBaseB2A,
    special: nextSpecialB2A,
    baseBeforeSpecial: baseBeforeSpecialB2A,
  };

  // 旧フィールド用（互換）：impression は base を使う
  const prevA2B = prevStateA2B.base;
  const prevB2A = prevStateB2A.base;
  const nextA2B = nextStateA2B.base;
  const nextB2A = nextStateB2A.base;

  // 7) SYSTEM 行（UI用サマリ）
  const bits: string[] = [];
  if (a2bFavor !== 0) bits.push(`${a}→${b} 好感度: ${a2bFavor > 0 ? '↑' : '↓'}`);
  if (b2aFavor !== 0) bits.push(`${b}→${a} 好感度: ${b2aFavor > 0 ? '↑' : '↓'}`);
  if (nextA2B !== prevA2B) bits.push(`${a}→${b} 印象: ${prevA2B}→${nextA2B}`);
  if (nextB2A !== prevB2A) bits.push(`${b}→${a} 印象: ${prevB2A}→${nextB2A}`);
  if (newBeliefs.length) bits.push(`Belief更新: ${newBeliefs.length}件`);
  const systemLine = bits.length ? `SYSTEM: ${bits.join(' / ')}` : '';

  // 8) 最終 return
  return {
    deltas: {
      aToB: { favor: a2bFavor, impression: nextA2B, impressionState: nextStateA2B },
      bToA: { favor: b2aFavor, impression: nextB2A, impressionState: nextStateB2A },
    },
    newBeliefs,
    threadNextState,
    systemLine,
  };
}
