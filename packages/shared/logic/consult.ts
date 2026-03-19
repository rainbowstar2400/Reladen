// packages/shared/logic/consult.ts
// 相談システムの共有ロジック — 抽選ウェイト、trustDelta、カテゴリ/シード

// ---------------------------------------------------------------------------
// 信頼度バンド
// ---------------------------------------------------------------------------

export type TrustBand = 'guarded' | 'distant' | 'favorable' | 'intimate';

export function getTrustBand(trust: number): TrustBand {
  if (trust >= 75) return 'intimate';
  if (trust >= 50) return 'favorable';
  if (trust >= 25) return 'distant';
  return 'guarded';
}

const TRUST_BAND_WEIGHT: Record<TrustBand, number> = {
  guarded: 0,
  distant: 1,
  favorable: 3,
  intimate: 5,
};

export function getTrustBandWeight(band: TrustBand): number {
  return TRUST_BAND_WEIGHT[band];
}

/** 信頼度帯ごとのトーンラベル（GPTプロンプト用） */
export const TRUST_BAND_TONE: Record<TrustBand, string> = {
  guarded: '警戒的',
  distant: 'よそよそしい',
  favorable: '好意的',
  intimate: '打ち解けた・親密',
};

// ---------------------------------------------------------------------------
// 抽選ウェイト
// ---------------------------------------------------------------------------

export function calcConsultWeight(params: {
  trust: number;
  traits: { sociability: number; empathy: number; stubbornness: number };
}): number {
  const band = getTrustBand(params.trust);
  const tbw = getTrustBandWeight(band);
  if (tbw === 0) return 0;

  const { sociability, empathy, stubbornness } = params.traits;
  const personalityWeight =
    1.0 +
    (sociability - 3) * 0.15 +
    (empathy - 3) * 0.1 +
    (stubbornness - 3) * -0.1;

  return tbw * Math.max(0, personalityWeight);
}

// ---------------------------------------------------------------------------
// trustDelta 計算
// ---------------------------------------------------------------------------

export type Favorability = 'positive' | 'neutral' | 'negative';

const BASE_DELTA: Record<Favorability, number> = {
  positive: 3,
  neutral: 0.5,
  negative: -3,
};

export function calcTrustDelta(params: {
  favorability: Favorability;
  traits: { empathy: number; stubbornness: number; expressiveness: number };
}): number {
  const baseDelta = BASE_DELTA[params.favorability];
  const { empathy, stubbornness, expressiveness } = params.traits;
  const modifier =
    1.0 +
    (empathy - 3) * 0.1 +
    (stubbornness - 3) * -0.1 +
    (expressiveness - 3) * 0.05;

  return Math.round(baseDelta * modifier);
}

// ---------------------------------------------------------------------------
// カテゴリ・シード（信頼度帯別の重み付き抽選）
// ---------------------------------------------------------------------------

export type ConsultCategory = 'relationship' | 'daily_worry' | 'future_anxiety' | 'casual';

/** カテゴリごとのシード候補 */
const CATEGORY_SEEDS: Record<ConsultCategory, string[]> = {
  relationship: ['特定の相手との距離感', 'グループ内での居場所', 'すれ違い', '仲直りの方法', '新しい出会い'],
  daily_worry: ['最近の失敗', '体調や習慣', '忘れ物・うっかり', '時間の使い方', '片付け'],
  future_anxiety: ['将来の夢', '仕事の不安', '自分の居場所', '変わりたい気持ち', 'やりたいこと'],
  casual: ['最近のマイブーム', 'おすすめの場所', '好きな季節', '面白かったこと', '食べたいもの'],
};

/**
 * 信頼度帯別カテゴリ出現率:
 *   distant(25-49):   重い=低, 軽い=高
 *   favorable(50-74): 均等
 *   intimate(75-100): 重い=高, 軽い=低
 */
const CATEGORY_WEIGHTS: Record<Exclude<TrustBand, 'guarded'>, Record<ConsultCategory, number>> = {
  distant: { relationship: 1, daily_worry: 2, future_anxiety: 1, casual: 4 },
  favorable: { relationship: 2, daily_worry: 2, future_anxiety: 2, casual: 2 },
  intimate: { relationship: 4, daily_worry: 2, future_anxiety: 3, casual: 1 },
};

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function pickCategoryAndSeed(trustBand: TrustBand): {
  category: ConsultCategory;
  seed: string;
} {
  if (trustBand === 'guarded') {
    // guarded は相談対象外だが、安全策として casual を返す
    return { category: 'casual', seed: 'ちょっとした話題' };
  }

  const catWeights = CATEGORY_WEIGHTS[trustBand];
  const categories = Object.keys(catWeights) as ConsultCategory[];
  const weights = categories.map((c) => catWeights[c]);
  const category = weightedPick(categories, weights);

  const seeds = CATEGORY_SEEDS[category];
  const seed = seeds[Math.floor(Math.random() * seeds.length)];

  return { category, seed };
}

// ---------------------------------------------------------------------------
// 関係遷移相談の選択肢テンプレート
// ---------------------------------------------------------------------------

export type TransitionChoice = {
  id: string;
  label: string;
  favorability: Favorability;
};

export function buildTransitionChoices(trigger: 'confession' | 'breakup'): TransitionChoice[] {
  if (trigger === 'confession') {
    return [
      { id: 'c1', label: '応援する！きっとうまくいくよ', favorability: 'positive' },
      { id: 'c2', label: 'いいんじゃないかな…頑張って', favorability: 'neutral' },
      { id: 'c3', label: 'まだ早いんじゃないかな', favorability: 'negative' },
    ];
  }

  // breakup
  return [
    { id: 'c1', label: 'そう思うなら、自分の気持ちに正直に', favorability: 'positive' },
    { id: 'c2', label: '…そうだね、仕方ないのかも', favorability: 'neutral' },
    { id: 'c3', label: 'もう少し考えてみたら？', favorability: 'negative' },
  ];
}

// ---------------------------------------------------------------------------
// 頻度制御ヘルパー
// ---------------------------------------------------------------------------

/** 相談の有効期限（生成から10時間後） */
export const CONSULT_EXPIRY_HOURS = 10;

/** 同一キャラの相談間隔（1日1回） */
export const CONSULT_DAILY_LIMIT_MS = 24 * 60 * 60 * 1000;

/** 再トリガー防止のクールダウン（7日） */
export const CONSULT_COOLDOWN_DAYS = 7;
