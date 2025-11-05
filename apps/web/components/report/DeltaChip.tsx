'use client';

import * as React from 'react';

type FavorDelta = number;
type ImpressionLabel = 'dislike' | 'awkward' | 'none' | 'curious' | 'like?' | 'like' | string;

type Variant = 'favor' | 'impression';

export type DeltaChipProps = {
  variant: Variant;
  value: FavorDelta | ImpressionLabel;
  /** 小さめ表示にする（行間を詰める） */
  size?: 'sm' | 'md';
  /** ツールチップ用の title（未指定なら自動生成） */
  title?: string;
  /** className 追加（レイアウト側で余白を調整したい場合に） */
  className?: string;
};

/** 符号付き数値のフォーマット（+1 / -1 / ±0） */
function formatFavor(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${n}`;
  return '±0';
}

/** 印象ラベル → 表示名（UIラベル） */
function labelImpression(s: ImpressionLabel): string {
  switch (s) {
    case 'dislike': return '嫌い';
    case 'awkward': return '気まずい';
    case 'none':    return '→';
    case 'curious': return '気になる';
    case 'like?':   return '好きかも';
    case 'like':    return '好き';
    default:        return String(s || '→');
  }
}

/** favor の色付け */
function colorFavor(n: number): string {
  if (n > 0) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (n < 0) return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
  return 'bg-gray-50 text-gray-600 ring-1 ring-gray-200';
}

/** impression の色付け */
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

/** title の自動生成 */
function autoTitle(variant: Variant, v: FavorDelta | ImpressionLabel): string {
  if (variant === 'favor') return `好感度: ${formatFavor(v as number)}`;
  return `印象: ${labelImpression(v as ImpressionLabel)}`;
}

/**
 * DeltaChip: 好感度Δ / 印象ラベルを小さなチップで表示する。
 * - 依存を増やさず Tailwind のみで視認性を確保
 * - 後からアイコン・アニメを載せられるよう構造はシンプルに
 */
export default function DeltaChip(props: DeltaChipProps) {
  const { variant, value, size = 'md', title, className } = props;

  const isFavor = variant === 'favor';
  const base =
    'inline-flex items-center rounded-full px-2 py-[2px] leading-none select-none ' +
    'text-xs font-medium transition-colors';

  const sizeCls = size === 'sm' ? 'text-[11px] px-1.5 py-[1px]' : '';
  const palette = isFavor ? colorFavor(value as number) : colorImpression(value as ImpressionLabel);
  const content = isFavor ? formatFavor(value as number) : labelImpression(value as ImpressionLabel);

  return (
    <span
      className={`${base} ${sizeCls} ${palette} ${className ?? ''}`}
      title={title ?? autoTitle(variant, value)}
      aria-label={title ?? autoTitle(variant, value)}
    >
      {content}
    </span>
  );
}
