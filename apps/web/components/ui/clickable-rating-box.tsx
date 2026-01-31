'use client';

import React from 'react';
import { cn } from '@/lib/utils'; // プロジェクトの cn ユーティリティを使用

type Props = {
  value: number; // 1 から 5 の現在の値
  onChange: (newValue: number) => void;
};

const RATING_VALUES = [1, 2, 3, 4, 5];

export function ClickableRatingBox({ value, onChange }: Props) {
  /**
   * 親コンテナ（ボックス間）がクリックされた時の処理
   */
  const handleClickOnContainer = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    if (e.target !== e.currentTarget) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const containerWidth = rect.width;
    const percentage = clickX / containerWidth;

    const newValue = Math.min(
      5,
      Math.floor(percentage * RATING_VALUES.length) + 1,
    );

    onChange(newValue);
  };

  /**
   * 個別のボックス（数値）がクリックされた時の処理
   */
  const handleClickOnBox = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    num: number,
  ) => {
    e.stopPropagation();
    onChange(num);
  };

  return (
    <div
      className="flex w-full cursor-pointer overflow-hidden rounded-md border border-border" // shadcn/ui の border 色を使用
      onClick={handleClickOnContainer}
      role="radiogroup"
    >
      {RATING_VALUES.map((num, index) => (
        <div
          key={num}
          className={cn(
            'flex-1 select-none py-2 text-center text-sm font-medium',
            index > 0 && 'border-l border-white/40',
            value === num
              ? 'bg-primary text-primary-foreground'
              : 'bg-white/12 text-black/80 hover:bg-white/20'
          )}
          onClick={(e) => handleClickOnBox(e, num)}
          role="radio"
          aria-checked={value === num}
          aria-label={`評価 ${num}`}
        >
          {num}
        </div>
      ))}
    </div>
  );
}
