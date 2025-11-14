'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import {
  usePresetsByCategory,
  useUpsertPreset,
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
 * カテゴリごとのプリセット管理UI (★ タブの中身)
 */
function PresetCategoryManager({ category }: { category: PresetCategory }) {
  const details = CATEGORY_DETAILS[category];

  // usePresetsByCategory フックを使用 (ステップ2でマージ対応)
  const { data: items = [], isLoading } = usePresetsByCategory(category);

  // データの更新・削除用フックを呼び出し
  const upsertPreset = useUpsertPreset();

  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const handleAdd = () => {
    if (!newLabel || (category === 'speech' && !newDescription)) return;

    // 既存の項目に同じラベルがないかチェック
    const existing = items.find(item => item.label === newLabel);

    if (existing && !existing.isManaged) {
      // 既存の非管理プリセットを管理対象にする (Switch をオンにするのと同じ)
      upsertPreset.mutate({ id: existing.id, isManaged: true }, {
        onSuccess: () => {
          setNewLabel('');
          setNewDescription('');
        }
      });
    } else if (!existing) {
      // 新規追加
      const newItem: Partial<Preset> = {
        category,
        label: newLabel,
        description: category === 'speech' ? newDescription : undefined,
        isManaged: true, // このフォームから追加するものは isManaged: true
      };
      upsertPreset.mutate(newItem, {
        onSuccess: () => {
          setNewLabel('');
          setNewDescription('');
        }
      });
    }
    // (既に isManaged: true の場合は何もしない)
  };

  // isManaged をトグルする関数
  const handleToggleManaged = (id: string, newIsManaged: boolean) => {
    // API (フック) を呼び出し
    upsertPreset.mutate({ id, isManaged: newIsManaged });
  };

  // ローディング中と更新中の状態
  const isMutating = upsertPreset.isPending;

  return (
    <Card>
      {/* <CardHeader> (Tabs 側で表示) </CardHeader> */}
      <CardContent className="space-y-4 pt-6">

        {/* ローディング表示 */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            読み込み中...
          </div>
        )}

        {/* 既存のリスト */}
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              // isManaged: false の場合は少し薄く表示
              className={`flex flex-col gap-1 rounded-md border p-3 ${!item.isManaged ? 'border-dashed opacity-70' : ''
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{item.label}</span>

                {/* 削除ボタンの代わりに Switch を使用 */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id={`switch-${item.id}`}
                    checked={item.isManaged}
                    onCheckedChange={(checked) => handleToggleManaged(item.id, checked)}
                    disabled={isMutating} // 更新中は無効化
                  />
                  <Label htmlFor={`switch-${item.id}`} className="text-xs text-muted-foreground">
                    {item.isManaged ? 'リスト表示' : '非表示'}
                  </Label>
                </div>
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
          <p className="text-sm font-medium">新規プリセットを追加</p>
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
            disabled={!newLabel || (category === 'speech' && !newDescription) || isMutating}
            className="mt-2"
          >
            {isMutating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                更新中...
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
  // タブの制御
  const [activeTab, setActiveTab] = useState<PresetCategory>('speech');
  const activeDetails = CATEGORY_DETAILS[activeTab];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">プリセット管理</h1>
      <p className="text-sm text-muted-foreground">
        住人登録時の選択リストに表示されるプリセット（話し方、職業、一人称）を管理します。
      </p>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as PresetCategory)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="speech">
            {CATEGORY_DETAILS['speech'].title}
          </TabsTrigger>
          <TabsTrigger value="occupation">
            {CATEGORY_DETAILS['occupation'].title}
          </TabsTrigger>
          <TabsTrigger value="first_person">
            {CATEGORY_DETAILS['first_person'].title}
          </TabsTrigger>
        </TabsList>

        {/* タブの説明 */}
        <p className="mt-2 text-sm text-muted-foreground">
          {activeDetails.desc}
        </p>

        <div className="mt-4">
          <TabsContent value="speech">
            <PresetCategoryManager category="speech" />
          </TabsContent>
          <TabsContent value="occupation">
            <PresetCategoryManager category="occupation" />
          </TabsContent>
          <TabsContent value="first_person">
            <PresetCategoryManager category="first_person" />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}