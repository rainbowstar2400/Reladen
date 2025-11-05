'use client';

import * as React from 'react';

type FavorDelta = number;
type ImpressionLabel = 'dislike' | 'awkward' | 'none' | 'curious' | 'like?' | 'like' | string;
type Variant = 'favor' | 'impression';

export type DeltaChipProps = {
  variant: Variant;
  value: FavorDelta | ImpressionLabel;
  size?: 'sm' | 'md';
  title?: string;
  className?: string;
};

/** 好感度変化を↑↓だけで表示 */
function formatFavorSymbol(n: number): string | null {
  if (n > 0) return '↑';
  if (n < 0) return '↓';
  return null; // ← 変化なしの場合は非表示
}

/** 印象ラベル → 表示名 */
function labelImpression(s: ImpressionLabel): string {
  switch (s) {
    case 'dislike': return '嫌い';
    case 'awkward': return '気まずい';
    case 'none':    return 'なし';
    case 'curious': return '気になる';
    case 'like?':   return '好きかも';
    case 'like':    return '好き';
    default:        return String(s || '→');
  }
}

/** 色定義 */
function colorFavor(n: number): string {
  if (n > 0) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (n < 0) return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
  return '';
}
function colorImpression(s: ImpressionLabel): string {
  switch (s) {
    case 'dislike': return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
    case 'awkward': return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    case 'none':    return 'bg-gray-50 text-gray-600 ring-1 ring-gray-200';
    case 'curious': return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200';
    case 'like?':   return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
    case 'like':    return 'bg-green-50 text-green-700 ring-1 ring-green-200';
    default:        return 'bg-gray-50 text-gray-600 ring-1 ring-gray-200';
  }
}

export default function DeltaChip(props: DeltaChipProps) {
  const { variant, value, size = 'md', title, className } = props;

  // --- 「好感度」用: 変化なしならレンダーしない ---
  if (variant === 'favor') {
    const sym = formatFavorSymbol(value as number);
    if (!sym) return null; // ★ 表示しない
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-[2px] leading-none select-none text-xs font-medium ${colorFavor(value as number)} ${className ?? ''}`}
        title={title ?? (value as number > 0 ? '好感度が上昇' : '好感度が下降')}
      >
        {sym}
      </span>
    );
  }

  // --- 「印象」用（常に表示） ---
  const label = labelImpression(value as ImpressionLabel);
  const palette = colorImpression(value as ImpressionLabel);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-[2px] leading-none select-none text-xs font-medium ${palette} ${className ?? ''}`}
      title={title ?? `印象: ${label}`}
    >
      {label}
    </span>
  );
}
