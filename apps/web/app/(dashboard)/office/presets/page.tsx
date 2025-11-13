'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { presetCategoryEnum } from '@/lib/drizzle/schema';
import { Trash2, Loader2 } from 'lucide-react';
import {
  usePresetsByCategory,
  useUpsertPreset,
  useDeletePreset,
  type Preset,
  type PresetCategory,
} from '@/lib/data/presets';

const CATEGORY_DETAILS: Record<PresetCategory, { title: string; desc: string; labelHelp: string; descHelp?: string }> = {
  speech: {
    title: '話し方プリセット',
    desc: '住人の会話における「話し方」を管理します。',
    labelHelp: '例: ていねい',
    descHelp: '例: 常に敬語を使い…',
  },
  occupation: {
    title: '職業プリセット',
    desc: '「職業」の候補リストを管理します。',
    labelHelp: '例: 学生',
  },
  first_person: {
    title: '一人称プリセット',
    desc: '「一人称」候補リストを管理します。',
    labelHelp: '例: 私',
  },
};

/**
 * カテゴリごとのプリセット管理UI (実データ対応版)
 */
function PresetCategoryManager({ category }: { category: PresetCategory }) {
  const details = CATEGORY_DETAILS[category];

  // useState(MOCK_DATA) の代わりに usePresetsByCategory フックを使用
  const { data: items = [], isLoading } = usePresetsByCategory(category);

  // データの更新・削除用フックを呼び出し
  const upsertPreset = useUpsertPreset();
  const deletePreset = useDeletePreset();

  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const handleAdd = () => {
    if (!newLabel || (category === 'speech' && !newDescription)) return;

    const newItem: Partial<Preset> = {
      // id は upsert フック側で生成
      category,
      label: newLabel,
      description: category === 'speech' ? newDescription : undefined,
      isManaged: true, // このページで追加するものは isManaged: true
    };

    // setItems() の代わりに API (フック) を呼び出し
    upsertPreset.mutate(newItem, {
      onSuccess: () => {
        // 成功したら入力欄をクリア
        setNewLabel('');
        setNewDescription('');
      },
      // (onError は useMutation のグローバル設定に任せるか、ここで toast を表示)
    });
  };

  const handleDelete = (id: string) => {
    // setItems() の代わりに API (フック) を呼び出し
    if (window.confirm('このプリセットを削除しますか？ (関連する住人からは解除されます)')) {
      deletePreset.mutate(id);
    }
  };

  // ローディング中と更新中の状態
  const isMutating = upsertPreset.isPending || deletePreset.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{details.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{details.desc}</p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* ローディング表示 */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            読み込み中...
          </div>
        )}

        {/* 既存のリスト */}
        <div className="space-y-2">
          {/* isManaged: true のものだけをフィルタ (フックが全件返す場合に備える) */}
          {items.filter(item => item.isManaged).map((item) => (
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
                  disabled={isMutating} // 更新中は無効化
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
            disabled={isMutating} // 更新中は無効化
          />

          {category === 'speech' && (
            <Textarea
              placeholder={details.descHelp}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
              disabled={isMutating} // 更新中は無効化
            />
          )}

          <Button
            onClick={handleAdd}
            // upsertPreset.isPending もチェック
            disabled={!newLabel || (category === 'speech' && !newDescription) || isMutating}
            className="mt-2"
          >
            {upsertPreset.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                追加中...
              </>
            ) : (
              '追加'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PresetsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">プリセット管理</h1>
      <p className="text-sm text-muted-foreground">
        住人登録時の選択リストに表示されるプリセット（話し方、職業、一人称）を管理します。
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PresetCategoryManager category="speech" />
        <PresetCategoryManager category="occupation" />
        <PresetCategoryManager category="first_person" />
      </div>
    </div>
  );
}