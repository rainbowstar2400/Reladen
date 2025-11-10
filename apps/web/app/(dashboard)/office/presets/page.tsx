'use client';

// ★ 仮のプリセット管理ページ
// 実際にはDBからデータを取得・更新するロジック (例: useQuery, useMutation) が必要
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'; //
import { presetCategoryEnum } from '@/lib/drizzle/schema'; // schema から型をインポート

type PresetCategory = typeof presetCategoryEnum.enumValues[number]; // 'speech' | 'occupation' | 'first_person'
type PresetItem = {
  id: string;
  category: PresetCategory;
  value: string;
  label: string;
};

// 仮のデータ (実際には API から取得)
const MOCK_DATA: Record<PresetCategory, PresetItem[]> = {
  speech: [
    { id: 's1', category: 'speech', value: 'polite', label: 'ていねい' },
    { id: 's2', category: 'speech', value: 'casual', label: 'くだけた' },
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

// プリセットのカテゴリごとの管理UI (仮)
function PresetCategoryManager({
  category,
  title,
  description,
}: {
  category: PresetCategory;
  title: string;
  description: string;
}) {
  // 実際には useQuery などでデータをフェッチする
  const [items, setItems] = useState(MOCK_DATA[category]);
  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');

  // 実際には useMutation を使う
  const handleAdd = () => {
    if (!newValue || !newLabel) return;
    const newItem: PresetItem = {
      id: crypto.randomUUID(),
      category,
      value: newValue,
      label: newLabel,
    };
    setItems([...items, newItem]);
    setNewValue('');
    setNewLabel('');
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
        <CardTitle>{title}</CardTitle>
        {/* ★ 変更: CardDescription を <p> タグに変更 */}
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 既存のリスト */}
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md border p-2"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm">{item.value}</span>
                <span className="text-xs text-muted-foreground">({item.label})</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(item.id)}
              >
                削除
              </Button>
            </div>
          ))}
        </div>

        {/* 新規追加フォーム */}
        <div className="flex gap-2 rounded-md border border-dashed p-3">
          <Input
            placeholder="値 (例: polite)"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <Input
            placeholder="ラベル (例: ていねい)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <Button onClick={handleAdd} disabled={!newValue || !newLabel}>
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
        住人登録フォームなどで使用する選択肢（サジェスト）を管理します。
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PresetCategoryManager
          category="speech"
          title="話し方プリセット"
          description="（例：polite, casual）"
        />
        <PresetCategoryManager
          category="occupation"
          title="職業プリセット"
          description="（例：student, office）"
        />
        <PresetCategoryManager
          category="first_person"
          title="一人称プリセット"
          description="（例：私, 僕, 俺）"
        />
      </div>
    </div>
  );
}