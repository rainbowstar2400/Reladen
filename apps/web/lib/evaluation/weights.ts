// apps/web/lib/evaluation/weights.ts
// ------------------------------------------------------------
// 会話評価の「唯一の定義元」。
// タグ/品質/シグナルの重みや、印象ラダーと1段階制限をここに集約。
// 将来的に JSON 外出しにする場合も、このファイルを窓口にする。
// ------------------------------------------------------------

export type Impression =
  | 'none'
  | 'curious'
  | 'like?'
  | 'like'
  | 'dislike'
  | 'awkward';

// 会話行為タグ → 好感度への寄与（方向A→B/B→Aに等しく適用）
export const TagWeights: Record<string, number> = {
  // ポジティブ寄与
  '共感': 0.6,
  '感謝': 0.7,
  '称賛': 0.8,
  '協力': 0.5,

  // ネガティブ寄与
  '否定': -0.8,
  '皮肉': -0.5,
  '非難': -1.2,

  // 中立/軽微
  '情報共有': 0.1,
  '軽い冗談': 0.2,
};

// qualityHints のキー → 好感度への寄与
// 値の有無を問わず「キーの出現」で判定（将来は値に応じた重みも可能）
export const QualityWeights: Record<string, number> = {
  'coherence.good': 0.2,
  'coherence.poor': -0.4,
  'tone.gentle': 0.2,
  'tone.harsh': -0.4,
};

// GPTメタ signals → スレッド進行の寄与
export const SignalWeights: Record<'continue' | 'close' | 'park', number> = {
  continue: 0.1, // 継続の意思：微増
  close: 0.2,    // まとまり：やや増
  park: 0,       // 保留：変化なし
};

// 好感度の1回あたりのクリップ範囲
export const FavorClip = { min: -2, max: 2 } as const;

// 印象の並び順（1段階制限に使う）
export const ImpressionOrder: Impression[] = [
  'dislike', // 最も低い
  'awkward',
  'none',
  'curious',
  'like?',
  'like',    // 最も高い
];

// 印象を1段階だけ上げ下げ
export function nextImpression(current: Impression, deltaSign: number): Impression {
  if (deltaSign === 0) return current;
  const idx = ImpressionOrder.indexOf(current);
  if (idx < 0) return current;
  if (deltaSign > 0) return ImpressionOrder[Math.min(idx + 1, ImpressionOrder.length - 1)];
  return ImpressionOrder[Math.max(idx - 1, 0)];
}

// 好感度のクリップ
export function clipFavor(x: number): number {
  return Math.max(FavorClip.min, Math.min(FavorClip.max, x));
}
