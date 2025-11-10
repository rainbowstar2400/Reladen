'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; //
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'; //
import { presetCategoryEnum } from '@/lib/drizzle/schema'; //
import { Trash2 } from 'lucide-react';

type PresetCategory = typeof presetCategoryEnum.enumValues[number];
type PresetItem = {
  id: string; // DBの主キー (uuid)
  category: PresetCategory;
  label: string; // 表示名
  description?: string | null;
  isManaged: boolean;
};

// 仮のデータ (isManaged: true のものが管理対象)
const MOCK_DATA: Record<PresetCategory, PresetItem[]> = {
  speech: [
    { id: 'uuid-s1', category: 'speech', label: 'ていねい', description: '常に敬語を使い、相手を尊重する話し方。', isManaged: true },
    { id: 'uuid-s2', category: 'speech', label: 'くだけた', description: '友人や親しい人との間で使われる、フレンドリーな話し方。', isManaged: true },
  ],
  occupation: [
    { id: 'uuid-o1', category: 'occupation', label: '学生', isManaged: true },
    { id: 'uuid-o2', category: 'occupation', label: '会社員', isManaged: true },
    { id: 'uuid-o3', category: 'occupation', label: 'エンジニア', isManaged: true },
    { id: 'uuid-o4', category: 'occupation', label: '浪人生', isManaged: false }, // これは表示されない
  ],
  first_person: [
    { id: 'uuid-f1', category: 'first_person', label: '私', isManaged: true },
    { id: 'uuid-f2', category: 'first_person', label: '僕', isManaged: true },
    { id: 'uuid-f3', category: 'first_person', label: '拙者', isManaged: false }, // これは表示されない
  ],
};

const CATEGORY_DETAILS: Record<PresetCategory, { title: string; desc: string; labelHelp: string; descHelp?: string }> = {
  speech: {
    title: '話し方プリセット',
    desc: '会話生成時にAIに渡す「話し方」を管理します。',
    labelHelp: 'ラベル (例: ていねい)',
    descHelp: 'AIへの指示 (例: 常に敬語を使い…)',
  },
  occupation: {
    title: '職業プリセット',
    desc: '住人フォームの「職業」サジェストを管理します。',
    labelHelp: 'ラベル (例: 学生)',
  },
  first_person: {
    title: '一人称プリセット',
    desc: '住人フォームの「一人称」サジェストを管理します。',
    labelHelp: 'ラベル (例: 私)',
  },
};

/**
 * カテゴリごとのプリセット管理UI (仮)
 */
function PresetCategoryManager({ category }: { category: PresetCategory }) {
  const details = CATEGORY_DETAILS[category];
  
  // ★ 変更: isManaged: true のものだけをフィルタ
  const [items, setItems] = useState(MOCK_DATA[category].filter(item => item.isManaged));
  
  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const handleAdd = () => {
    if (!newLabel || (category === 'speech' && !newDescription)) return;
    
    const newItem: PresetItem = {
      id: crypto.randomUUID(), // DBの主キー (仮)
      category,
      label: newLabel,
      description: category === 'speech' ? newDescription : undefined,
      isManaged: true, // ★ このページで追加するものは isManaged: true
    };
    
    setItems([...items, newItem]);
    setNewLabel('');
    setNewDescription('');
    // TODO: API 呼び出し (addPreset.mutate(newItem))
    console.log('Add Managed Preset:', newItem);
  };

  const handleDelete = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
    // TODO: API 呼び出し (deletePreset.mutate(id))
    // 実際には削除せず isManaged: false にする or 関連する住人がいないかチェックする
    console.log('Delete/Unmanage Preset:', id);
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
                <span className="font-semibold">{item.label}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleDelete(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
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
          <Input
            placeholder={details.labelHelp}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />

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
            disabled={!newLabel || (category === 'speech' && !newDescription)}
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
        住人登録フォームの選択リストに表示されるプリセット（話し方、職業、一人称）を管理します。
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PresetCategoryManager category="speech" />
        <PresetCategoryManager category="occupation" />
        <PresetCategoryManager category="first_person" />
      </div>
    </div>
  );
}