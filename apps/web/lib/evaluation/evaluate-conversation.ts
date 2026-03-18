// apps/web/lib/evaluation/evaluate-conversation.ts

import { clipFavor, type Impression, type ImpressionBase } from './weights';

// ------------------------------------------------------------
// GPT応答（会話イベント）をローカルで評価し、Δ値・印象・スレッド進行を決定
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
    qualityHints?: Record<string, unknown>;
    impressionSpecial?: { setAwkward?: boolean; clearAwkward?: boolean };
  };
  currentImpression?: {
    aToB: Impression | ImpressionState;
    bToA: Impression | ImpressionState;
  };
  // --- Phase 2: A-5 3層乗算用 ---
  characterProfiles?: {
    [characterId: string]: {
      traits: Partial<{ empathy: number; expressiveness: number; stubbornness: number }>;
      mbti?: string | null;
    };
  };
  stances?: { [characterId: string]: string };
  topicSource?: string;
  topicInitiatorId?: string;
  // --- Phase 4: A-7 約束フラグ ---
  /** 約束フラグ（コード側で事前に決定済み） */
  promiseFlag?: boolean;
  // --- Phase 2: A-3 2系列制 + A-4 3件窓 ---
  relationType?: string;
  recentDeltas?: {
    aToB: number[];
    bToA: number[];
  };
};

/** evaluateConversation の出力（persist 側が使う） */
export type EvaluationResult = {
  deltas: {
    aToB: { favor: number; impression: Impression; impressionState: ImpressionState };
    bToA: { favor: number; impression: Impression; impressionState: ImpressionState };
  };
  recentDeltas: {
    aToB: number[];
    bToA: number[];
  };
  threadNextState: 'ongoing' | 'done';
  systemLine: string;
};

// ===== タグ・品質・シグナルの重み =====

const TAG_WEIGHTS: Record<string, number> = {
  '共感': 0.6,
  '感謝': 0.7,
  '称賛': 0.8,
  '協力': 0.5,
  '否定': -0.8,
  '皮肉': -0.5,
  '非難': -1.2,
  '雑談・共通': 0.1,
  '軽い冗談': 0.2,
};

const QUALITY_WEIGHTS: Record<string, number> = {
  'coherence.good': 0.2,
  'coherence.poor': -0.4,
  'tone.gentle': 0.2,
  'tone.harsh': -0.4,
};


// ===== A-5: 3層乗算の定数・関数 =====

const STANCE_MODIFIERS: Record<string, number> = {
  enthusiastic: 1.3,
  agreeable: 1.0,
  reluctant: 0.7,
  indifferent: 0.5,
  confrontational: 1.2,
};

/** 感度係数: キャラ固有の受け取りやすさ (0.50〜1.50) */
export function calculateSensitivity(
  traits: Partial<{ empathy: number; expressiveness: number; stubbornness: number }>,
  mbti?: string | null,
): number {
  const empathy = traits.empathy ?? 3;
  const expressiveness = traits.expressiveness ?? 3;
  const stubbornness = traits.stubbornness ?? 3;

  let mbtiBonus = 0;
  if (mbti) {
    const upper = mbti.toUpperCase();
    if (upper.includes('F')) mbtiBonus = 0.10;
    else if (upper.includes('T')) mbtiBonus = -0.10;
  }

  return 1.0
    + (empathy - 3) * 0.10
    + (expressiveness - 3) * 0.05
    + (stubbornness - 3) * -0.05
    + mbtiBonus;
}

/** 話題ソース補正 */
function getTopicBonus(
  topicSource: string | undefined,
  characterId: string,
  topicInitiatorId: string | undefined,
): number {
  if (topicSource === 'self_experience' && characterId === topicInitiatorId) {
    return 1.2;
  }
  if (topicSource === 'heart_to_heart') {
    return 1.1;
  }
  return 1.0;
}

// ===== A-3: 2系列ラダー =====

const NORMAL_LADDER: ImpressionBase[] = ['maybe_dislike', 'none', 'curious', 'maybe_like'];
const SPECIAL_LADDER: ImpressionBase[] = ['dislike', 'none', 'like', 'love'];
const SPECIAL_RELATIONS = new Set(['best_friend', 'lover', 'family']);

function selectLadder(relationType: string | undefined): ImpressionBase[] {
  return SPECIAL_RELATIONS.has(relationType ?? '') ? SPECIAL_LADDER : NORMAL_LADDER;
}

function nextImpression1step(
  current: ImpressionBase,
  deltaSign: number,
  relationType?: string,
): ImpressionBase {
  if (deltaSign === 0) return current;
  const ladder = selectLadder(relationType);
  const i = ladder.indexOf(current);
  if (i < 0) return current;
  return deltaSign > 0
    ? ladder[Math.min(i + 1, ladder.length - 1)]
    : ladder[Math.max(i - 1, 0)];
}

/** 昇格時の印象リセット（friend → best_friend/lover） */
export function impressionOnPromotion(): ImpressionBase {
  return 'like';
}

/** 降格時の印象変換（best_friend/lover → friend: 好感度ベース） */
export function impressionOnDemotion(favorScore: number): ImpressionBase {
  if (favorScore >= 45) return 'maybe_like';
  if (favorScore >= 35) return 'curious';
  if (favorScore >= 25) return 'none';
  return 'maybe_dislike';
}

// ===== ユーティリティ =====

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

  const lines = Array.isArray(input.lines) ? input.lines : [];

  // 1) タグ重み加算 → baseFavor（A→B / B→A 共通）
  let baseFavor = 0;
  const tags: string[] = meta.tags ?? [];
  for (const t of tags) {
    baseFavor += TAG_WEIGHTS[t] ?? 0;
  }

  // 2) 会話バランス（均衡に微加点）
  const speakCountA = lines.filter((l) => l.speaker === a).length;
  const speakCountB = lines.filter((l) => l.speaker === b).length;
  const total = Math.max(1, speakCountA + speakCountB);
  const balance = Math.abs(speakCountA - speakCountB) / total;
  baseFavor += (1 - balance) * 0.2;

  // 3) qualityHints の重み
  const qh = meta.qualityHints ?? {};
  for (const k of Object.keys(qh)) {
    const w = QUALITY_WEIGHTS[k];
    if (typeof w === 'number') {
      baseFavor += w;
    }
  }

  // 4) A-5: 3層乗算で非対称化
  const sensA = input.characterProfiles?.[a]
    ? calculateSensitivity(input.characterProfiles[a].traits, input.characterProfiles[a].mbti)
    : 1.0;
  const sensB = input.characterProfiles?.[b]
    ? calculateSensitivity(input.characterProfiles[b].traits, input.characterProfiles[b].mbti)
    : 1.0;

  const stanceModA = STANCE_MODIFIERS[input.stances?.[a] ?? 'agreeable'] ?? 1.0;
  const stanceModB = STANCE_MODIFIERS[input.stances?.[b] ?? 'agreeable'] ?? 1.0;

  const topicBonusA = getTopicBonus(input.topicSource, a, input.topicInitiatorId);
  const topicBonusB = getTopicBonus(input.topicSource, b, input.topicInitiatorId);

  let a2bFavor = Math.round(baseFavor * sensA * stanceModA * topicBonusA);
  let b2aFavor = Math.round(baseFavor * sensB * stanceModB * topicBonusB);

  // 5) クリップ [-2, +2]
  a2bFavor = clipFavor(a2bFavor);
  b2aFavor = clipFavor(b2aFavor);

  // 6) スレッド進行: 約束フラグベース
  const threadNextState: EvaluationResult['threadNextState'] =
    input.promiseFlag ? 'ongoing' : 'done';

  // 7) A-4: 3件窓で印象判定
  const prevDeltasA2B = input.recentDeltas?.aToB ?? [];
  const prevDeltasB2A = input.recentDeltas?.bToA ?? [];

  const windowA2B = [a2bFavor, ...prevDeltasA2B].slice(0, 3);
  const windowB2A = [b2aFavor, ...prevDeltasB2A].slice(0, 3);

  const WINDOW_WEIGHTS = [4, 3, 2];
  let deltaSignA2B = 0;
  let deltaSignB2A = 0;
  let windowResetA2B = false;
  let windowResetB2A = false;

  if (windowA2B.length >= 3) {
    const scoreA2B = windowA2B[0] * WINDOW_WEIGHTS[0] + windowA2B[1] * WINDOW_WEIGHTS[1] + windowA2B[2] * WINDOW_WEIGHTS[2];
    if (scoreA2B >= 7) { deltaSignA2B = 1; windowResetA2B = true; }
    else if (scoreA2B <= -7) { deltaSignA2B = -1; windowResetA2B = true; }
  }

  if (windowB2A.length >= 3) {
    const scoreB2A = windowB2A[0] * WINDOW_WEIGHTS[0] + windowB2A[1] * WINDOW_WEIGHTS[1] + windowB2A[2] * WINDOW_WEIGHTS[2];
    if (scoreB2A >= 7) { deltaSignB2A = 1; windowResetB2A = true; }
    else if (scoreB2A <= -7) { deltaSignB2A = -1; windowResetB2A = true; }
  }

  // 8) A-3: 2系列ラダーで印象遷移
  const prevStateA2B = toState(input.currentImpression?.aToB as any, 'none');
  const prevStateB2A = toState(input.currentImpression?.bToA as any, 'none');

  let nextBaseA2B: ImpressionBase = nextImpression1step(prevStateA2B.base, deltaSignA2B, input.relationType);
  let nextBaseB2A: ImpressionBase = nextImpression1step(prevStateB2A.base, deltaSignB2A, input.relationType);

  // 9) awkward 処理
  const flags = meta.impressionSpecial ?? {};
  let nextSpecialA2B: 'awkward' | null = prevStateA2B.special ?? null;
  let nextSpecialB2A: 'awkward' | null = prevStateB2A.special ?? null;
  let baseBeforeSpecialA2B: ImpressionBase | null = prevStateA2B.baseBeforeSpecial ?? null;
  let baseBeforeSpecialB2A: ImpressionBase | null = prevStateB2A.baseBeforeSpecial ?? null;

  if (flags.setAwkward) {
    nextSpecialA2B = 'awkward';
    nextSpecialB2A = 'awkward';
    if (!baseBeforeSpecialA2B) baseBeforeSpecialA2B = nextBaseA2B;
    if (!baseBeforeSpecialB2A) baseBeforeSpecialB2A = nextBaseB2A;
  }

  if (flags.clearAwkward) {
    nextBaseA2B = baseBeforeSpecialA2B ?? nextBaseA2B;
    nextBaseB2A = baseBeforeSpecialB2A ?? nextBaseB2A;
    nextSpecialA2B = null;
    nextSpecialB2A = null;
    baseBeforeSpecialA2B = null;
    baseBeforeSpecialB2A = null;
  }

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

  const prevA2B = prevStateA2B.base;
  const prevB2A = prevStateB2A.base;
  const nextA2B = nextStateA2B.base;
  const nextB2A = nextStateB2A.base;

  // 10) SYSTEM 行
  const bits: string[] = [];
  if (a2bFavor !== 0) bits.push(`${a}→${b} 好感度: ${a2bFavor > 0 ? '↑' : '↓'}`);
  if (b2aFavor !== 0) bits.push(`${b}→${a} 好感度: ${b2aFavor > 0 ? '↑' : '↓'}`);
  if (nextA2B !== prevA2B) bits.push(`${a}→${b} 印象: ${prevA2B}→${nextA2B}`);
  if (nextB2A !== prevB2A) bits.push(`${b}→${a} 印象: ${prevB2A}→${nextB2A}`);
  const systemLine = bits.length ? `SYSTEM: ${bits.join(' / ')}` : '';

  // 11) return
  return {
    deltas: {
      aToB: { favor: a2bFavor, impression: nextA2B, impressionState: nextStateA2B },
      bToA: { favor: b2aFavor, impression: nextB2A, impressionState: nextStateB2A },
    },
    recentDeltas: {
      aToB: windowResetA2B ? [] : windowA2B,
      bToA: windowResetB2A ? [] : windowB2A,
    },
    threadNextState,
    systemLine,
  };
}
