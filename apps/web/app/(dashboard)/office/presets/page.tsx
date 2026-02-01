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
import { Loader2, Pencil, Check, X, Ban } from 'lucide-react';
import {
  usePresetsByCategory,
  useUpsertPreset,
  type Preset,
  type PresetCategory,
} from '@/lib/data/presets';
import { DeskPanel } from '@/components/room/desk-panel';
import { OfficePanelShell } from '@/components/room/office-panel-shell';

const CATEGORY_DETAILS: Record<PresetCategory, { title: string; desc: string; labelHelp: string; descHelp?: string; exampleHelp?: string }> = {
  speech: {
    title: '話し方プリセット',
    desc: '住人の会話における「話し方」を管理します。',
    labelHelp: '例: 優しい敬語',
    descHelp: '例: 丁寧で穏やかな話し方：「〜です」「〜ます」など',
    exampleHelp: '例: 　今日はいい感じだね。　のように書いてください',
  },
  occupation: {
    title: '職業プリセット',
    desc: '「職業」の候補リストを管理します。',
    labelHelp: '例: 高校生',
  },
  first_person: {
    title: '一人称プリセット',
    desc: '「一人称」候補リストを管理します。',
    labelHelp: '例: 私',
  },
};

/**
 * カテゴリごとのプリセット管理UI
 */
function PresetCategoryManager({ category }: { category: PresetCategory }) {
  const details = CATEGORY_DETAILS[category];

  // usePresetsByCategory フックを使用 (ステップ2でマージ対応)
  const { data: items = [], isLoading } = usePresetsByCategory(category);

  // データの更新・削除用フックを呼び出し
  const upsertPreset = useUpsertPreset();

  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newExample, setNewExample] = useState('');

  const [editingItem, setEditingItem] = useState<Preset | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editExample, setEditExample] = useState('');

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
          setNewExample('');
        }
      });
    } else if (!existing) {
      // 新規追加
      const newItem: Partial<Preset> = {
        category,
        label: newLabel,
        description: category === 'speech' ? newDescription : undefined,
        example: category === 'speech' ? (newExample || null) : undefined,
        isManaged: true, // このフォームから追加するものは isManaged: true
      };
      upsertPreset.mutate(newItem, {
        onSuccess: () => {
          setNewLabel('');
          setNewDescription('');
          setNewExample('');
        }
      });
    }
    // (既に isManaged: true の場合は何もしない)
  };

  // isManaged をトグルする関数
  const handleToggleManaged = (item: Preset, newIsManaged: boolean) => {
    // もし今 Mutate 中なら何もしない (連打防止)
    if (upsertPreset.isPending || isLoading) return;

    upsertPreset.mutate({
      id: item.id,
      isManaged: newIsManaged,
      // category と label を渡す (getLocal バイパス用)
      category: item.category,
      label: item.label,
    });
  };

  // 編集開始処理 (モーダルの時と同じ)
  const handleOpenEdit = (item: Preset) => {
    setEditingItem(item);
    setEditLabel(item.label);
    setEditDescription(item.description ?? '');
    setEditExample(item.example ?? '');
  };

  // 編集キャンセル処理 (モーダルの時と同じ)
  const handleCloseEdit = () => {
    setEditingItem(null);
    setEditLabel('');
    setEditDescription('');
    setEditExample('');
  };

  // 編集保存処理 (モーダルの時と同じ)
  const handleSaveEdit = () => {
    if (!editingItem || !editLabel) return;

    if (editingItem.owner_id === 'SYSTEM' && editingItem.label !== editLabel) {
      alert('デフォルトプリセットの名前は変更できません。');
      return;
    }

    upsertPreset.mutate({
      id: editingItem.id,
      label: editLabel,
      description: category === 'speech' ? editDescription : undefined,
      example: category === 'speech' ? (editExample || null) : undefined,
      category: editingItem.category,
    }, {
      onSuccess: () => {
        handleCloseEdit(); // 成功したら編集モードを解除
      }
    });
  };

  const isMutating = upsertPreset.isPending || isLoading;
  const isEditingAny = editingItem !== null;

  // disabled 判定を統合
  const uiDisabled = isMutating || isEditingAny;

  return (
    <div className="space-y-4">
      {/* <CardHeader> (Tabs 側で表示) </CardHeader> */}
      <CardContent className="space-y-4 px-0 pt-2">

        {/* ローディング表示 */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            読み込み中...
          </div>
        )}

        {/* 既存のリスト */}
        <div className="space-y-2">
          {items.map((item) => {
            const isThisEditing = editingItem?.id === item.id;

            return (
              <div
                key={item.id}
                className={`flex flex-col gap-1 rounded-md border border-white/55 bg-white/24 p-3 ${!item.isManaged ? 'border-dashed opacity-70' : ''
                  }`}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.34)',
                  borderColor: 'rgba(255,255,255,0.65)',
                }}
              >
                {isThisEditing ? (
                  // インライン編集中の表示
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor={`edit-label-${item.id}`}>ラベル</Label>
                      <Input
                        id={`edit-label-${item.id}`}
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder={details.labelHelp}
                        disabled={isMutating || item.owner_id === 'SYSTEM'}
                      />
                      {item.owner_id === 'SYSTEM' && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Ban className="h-3 w-3" />
                          デフォルトプリセットの名前は変更できません。
                        </p>
                      )}
                    </div>

                    {category === 'speech' && (
                      <>
                        <div className="space-y-1">
                          <Label htmlFor={`edit-desc-${item.id}`}>説明</Label>
                          <Textarea
                            id={`edit-desc-${item.id}`}
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder={details.descHelp}
                            rows={2}
                            disabled={isMutating}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`edit-example-${item.id}`}>例文</Label>
                          <Textarea
                            id={`edit-example-${item.id}`}
                            value={editExample}
                            onChange={(e) => setEditExample(e.target.value)}
                            placeholder={details.exampleHelp}
                            rows={2}
                            disabled={isMutating}
                          />
                        </div>
                      </>
                    )}

                    {/* 保存・キャンセルボタン */}
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleCloseEdit}
                        disabled={isMutating} // 保存中はキャンセル不可
                        aria-label="キャンセル"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleSaveEdit}
                        disabled={
                          !editLabel ||
                          (category === 'speech' && !editDescription) ||
                          isMutating // 保存中は連打不可
                        }
                        aria-label="保存"
                      >
                        {isMutating ? ( // upsertPreset.isPending を見る
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                ) : (
                  // === 通常時の表示 ===
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{item.label}</span>

                      <div className="flex items-center space-x-2">
                        {/* 編集ボタン */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => handleOpenEdit(item)}
                          disabled={uiDisabled} // 統合した disabled を使用
                          aria-label="編集"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        {/* Switch */}
                        <Switch
                          id={`switch-${item.id}`}
                          checked={item.isManaged}
                          onCheckedChange={(checked) => handleToggleManaged(item, checked)}
                          // 他の項目を編集中、または更新中は無効化
                          disabled={uiDisabled}
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
                    {item.example && (
                      <p className="pl-1 text-xs text-gray-600 dark:text-gray-400">
                        例文: {item.example}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* 新規追加フォーム */}
        <div
          className="flex flex-col gap-2 rounded-md border border-white/55 bg-white/24 p-3"
          style={{ backgroundColor: 'rgba(255,255,255,0.34)', borderColor: 'rgba(255,255,255,0.65)' }}
        >
          <p className="text-sm font-medium">新規プリセットを追加</p>
          <Input
            placeholder={details.labelHelp}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            disabled={uiDisabled}
          />

          {category === 'speech' && (
            <div className="space-y-2">
              <Textarea
                placeholder={details.descHelp}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                disabled={uiDisabled}
              />
              <p id="age-help" className="text-xs text-muted-foreground mt-1">
                「今日はいい感じ」ということを、どのように言いますか？」
              </p>
              <Textarea
                placeholder={details.exampleHelp}
                value={newExample}
                onChange={(e) => setNewExample(e.target.value)}
                rows={2}
                disabled={uiDisabled}
              />
            </div>
          )}

          <Button
            onClick={handleAdd}
            disabled={
              !newLabel ||
              (category === 'speech' && !newDescription) ||
              uiDisabled
            }
            className="mt-2 !border-white/65 !bg-none !bg-white/34 !text-slate-700 !shadow-none hover:!bg-white/38"
            style={{
              backgroundImage: 'none',
              backgroundColor: 'rgba(255,255,255,0.44)',
              border: '1px solid rgba(255,255,255,0.7)',
              boxShadow: '0 10px 18px rgba(6,18,32,0.16)',
              color: 'rgba(90,90,90,0.9)',
            }}
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
    </div>
  );
}

export default function PresetsPage() {
  // タブの制御
  const [activeTab, setActiveTab] = useState<PresetCategory>('speech');
  const activeDetails = CATEGORY_DETAILS[activeTab];

  return (
    <DeskPanel className="mx-auto mt-[clamp(24px,3vw,56px)] w-[min(100%,960px)]">
      <OfficePanelShell showTitle={false}>
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
      </OfficePanelShell>
    </DeskPanel>
  );
}
