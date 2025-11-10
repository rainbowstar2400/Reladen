'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// ★ 1. Textarea をインポート
import { Textarea } from '@/components/ui/textarea'; //
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'; //
import { presetCategoryEnum } from '@/lib/drizzle/schema'; //

type PresetCategory = typeof presetCategoryEnum.enumValues[number];
type PresetItem = {
  id: string;
  category: PresetCategory;
  value: string;
  label: string;
  // ★ 2. description を型に追加
  description?: string | null;
};

// ★ 3. モックデータに description を追加
const MOCK_DATA: Record<PresetCategory, PresetItem[]> = {
  speech: [
    { id: 's1', category: 'speech', value: 'polite', label: 'ていねい', description: '常に敬語を使い、相手を尊重する話し方。' },
    { id: 's2', category: 'speech', value: 'casual', label: 'くだけた', description: '友人や親しい人との間で使われる、フレンドリーな話し方。' },
  ],
  occupation: [
    { id: 'o1', category: 'occupation', value: 'student', label: '学生' },
    { id: 'o2', category: 'occupation', value: 'office', label: '会社員' },
  ],
  first_person: [
    { id: 'f1', category: 'first_person', value: '私', label: '私' },
    { id: 'f2', category: 'first_person', value: '僕', label: '僕' },
  ],
};

// ★ 4. カテゴリごとの説明を定義
const CATEGORY_DETAILS: Record<PresetCategory, { title: string; desc: string; valueHelp: string; labelHelp: string; descHelp?: string }> = {
  speech: {
    title: '話し方プリセット',
    desc: '会話生成時にAIに渡す「話し方」のキーと説明を管理します。',
    valueHelp: '値 (例: polite)',
    labelHelp: 'ラベル (例: ていねい)',
    descHelp: 'AIへの指示 (例: 常に敬語を使い…)',
  },
  occupation: {
    title: '職業プリセット',
    desc: '住人フォームの「職業」サジェストを管理します。',
    valueHelp: '値 (例: 学生)',
    labelHelp: 'ラベル (例: 学生)',
  },
  first_person: {
    title: '一人称プリセット',
    desc: '住人フォームの「一人称」サジェストを管理します。',
    valueHelp: '値 (例: 私)',
    labelHelp: 'ラベル (例: 私)',
  },
};


/**
 * カテゴリごとのプリセット管理UI
 */
function PresetCategoryManager({ category }: { category: PresetCategory }) {
  const details = CATEGORY_DETAILS[category];
  const [items, setItems] = useState(MOCK_DATA[category]);
  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');
  // ★ 5. description の state を追加
  const [newDescription, setNewDescription] = useState('');

  const handleAdd = () => {
    // 「話し方」以外は Description を必須としない
    if (!newValue || !newLabel || (category === 'speech' && !newDescription)) return;
    
    const newItem: PresetItem = {
      id: crypto.randomUUID(),
      category,
      value: newValue,
      label: newLabel,
      // ★ 6. description を item に追加
      ...(category === 'speech' ? { description: newDescription } : {}),
    };
    setItems([...items, newItem]);
    setNewValue('');
    setNewLabel('');
    setNewDescription(''); // ★ 7. state をクリア
    // TODO: API 呼び出し (addPreset.mutate(newItem))
    console.log('Add:', newItem);
  };

  const handleDelete = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
    // TODO: API 呼び出し (deletePreset.mutate(id))
    console.log('Delete:', id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{details.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{details.desc}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 既存のリスト */}
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-1 rounded-md border p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2 flex-wrap">
                  {/* 値 (value) */}
                  <span className="font-mono text-sm font-semibold">{item.value}</span>
                  {/* ラベル (label) */}
                  <span className="text-sm text-muted-foreground">({item.label})</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(item.id)}
                  className="shrink-0"
                >
                  削除
                </Button>
              </div>
              {/* ★ 8. description があれば表示 */}
              {item.description && (
                <p className="pl-1 text-xs text-gray-600 dark:text-gray-400">
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* 新規追加フォーム */}
        <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
          <div className="flex gap-2">
            <Input
              placeholder={details.valueHelp} // ★ 9. 動的プレースホルダー
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
            <Input
              placeholder={details.labelHelp} // ★ 10. 動的プレースホルダー
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>

          {/* ★ 11. 「話し方」の場合のみ Textarea を表示 */}
          {category === 'speech' && (
            <Textarea
              placeholder={details.descHelp}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
            />
          )}

          <Button
            onClick={handleAdd}
            // ★ 12. 「話し方」の場合は説明も必須とする
            disabled={!newValue || !newLabel || (category === 'speech' && !newDescription)}
            className="mt-2"
          >
            追加
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// プリセット管理ページの本体
export default function PresetsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">プリセット管理</h1>
      <p className="text-sm text-muted-foreground">
        住人登録などで使用する選択肢を管理できます。
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PresetCategoryManager category="speech" />
        <PresetCategoryManager category="occupation" />
        <PresetCategoryManager category="first_person" />
      </div>
    </div>
  );
}