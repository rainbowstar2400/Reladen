// apps/web/lib/evaluation/weights.ts
export type Impression = 'none' | 'curious' | 'like?' | 'like' | 'dislike' | 'awkward';

export const TagWeights: Record<string, number> = {
  // ポジ
  '共感': 0.6,
  '感謝': 0.7,
  '称賛': 0.8,
  '協力': 0.5,
  // ネガ
  '否定': -0.8,
  '皮肉': -0.5,
  '非難': -1.2,
  // 中立/文脈
  '情報共有': 0.1,
  '軽い冗談': 0.2,
};

export const QualityWeights: Record<string, number> = {
  // qualityHints の例（なければ無視）
  'coherence.good': 0.2,
  'coherence.poor': -0.4,
  'tone.gentle': 0.2,
  'tone.harsh': -0.4,
};

export const SignalWeights: Record<'continue'|'close'|'park', number> = {
  continue: 0.1,
  close: 0.2,
  park: 0,
};

export const FavorClip = { min: -2, max: 2 } as const;

// 印象ラダー：1段階以内でしか動かさない
export const ImpressionOrder: Impression[] = [
  'dislike', 'awkward', 'none', 'curious', 'like?', 'like'
];

export function nextImpression(current: Impression, delta: number): Impression {
  // delta > 0 なら 1段階上げ、delta < 0 なら 1段階下げ、0 なら据え置き
  if (delta === 0) return current;
  const idx = ImpressionOrder.indexOf(current);
  if (idx < 0) return current;
  if (delta > 0) return ImpressionOrder[Math.min(idx + 1, ImpressionOrder.length - 1)];
  return ImpressionOrder[Math.max(idx - 1, 0)];
}
