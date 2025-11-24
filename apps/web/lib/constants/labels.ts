import type { Feeling, Relation } from '@/types';

// 性格 (Traits)
export const DEFAULT_TRAITS = {
  sociability: 3,
  empathy: 3,
  stubbornness: 3,
  activity: 3,
  expressiveness: 3,
} as const;

export const TRAIT_LABELS: Record<keyof typeof DEFAULT_TRAITS, string> = {
  sociability: '社交性',
  empathy: '気配り',
  stubbornness: '頑固さ',
  activity: '行動力',
  expressiveness: '表現力',
};

// 関係性 (Relations)
export const RELATION_LABELS: Record<Relation['type'], string> = {
  none: 'なし',
  friend: '友達',
  best_friend: '親友',
  lover: '恋人',
  family: '家族',
};

// 感情 (Feelings)
export const FEELING_LABELS: Record<Feeling['label'], string> = {
  none: 'なし',
  dislike: '嫌い',
  maybe_dislike: '嫌いかも',
  curious: '気になる',
  maybe_like: '好きかも',
  like: '好き',
  love: '大好き',
  awkward: '気まずい',
};

// 性別 (Gender)
export const GENDER_LABELS: Record<string, string> = {
  male: '男性',
  female: '女性',
  nonbinary: 'なし',
  other: 'その他',
};
