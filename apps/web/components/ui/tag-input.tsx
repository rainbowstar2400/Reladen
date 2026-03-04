'use client';

import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type TagInputProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function TagInput({ value, onChange, placeholder, disabled, className }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const addTag = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInputValue('');
  }, [inputValue, value, onChange]);

  const removeTag = useCallback((index: number) => {
    onChange(value.filter((_, i) => i !== index));
  }, [value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-white/45 bg-white/15 px-2.5 py-0.5 text-xs text-white/90"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(i)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-white/20"
                aria-label={`${tag} を削除`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="flex h-8 w-full rounded-md border border-white/45 bg-white/10 px-3 py-1 text-sm text-white/90 placeholder:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="button"
            onClick={addTag}
            disabled={disabled || !inputValue.trim()}
            className="shrink-0 rounded-md border border-white/45 bg-white/15 px-3 py-1 text-xs text-white/90 hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            追加
          </button>
        </div>
      )}
    </div>
  );
}
