'use client';

import { useRouter } from 'next/navigation';
import { useResident, useDeleteResident, useResidents } from '@/lib/data/residents';
import { useRelations } from '@/lib/data/relations';
import { useFeelings } from '@/lib/data/feelings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { ResidentForm } from '@/components/forms/resident-form'; // フォームを削除
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Pencil, ChevronRight } from 'lucide-react'; // アイコンを追加
import { useMemo } from 'react';
import Link from 'next/link'; // Linkを追加
import { SleepProfile } from '../../../../../../../packages/shared/logic/schedule'; // 型をインポート
import { Feeling, Relation } from '@/types';

// --- (ここから) resident-form.tsx からモックデータとヘルパーを一時的に拝借 ---
// (本来は共有ライブラリに置くべき)
type ManagedPreset = { id: string; label: string; description?: string | null; isManaged: boolean };

const MOCK_PRESETS_DB: Record<'speech' | 'occupation' | 'first_person', ManagedPreset[]> = {
  speech: [
    { id: 'uuid-s1', label: 'ていねい', description: '常に敬語を使い、相手を尊重する話し方。', isManaged: true },
    { id: 'uuid-s2', label: 'くだけた', description: '友人や親しい人との間で使われる、フレンドリーな話し方。', isManaged: true },
    { id: 'uuid-s3-temp', label: '武士（ござる）', description: '語尾に「ござる」を付ける。', isManaged: false }, // 非管理
  ],
  occupation: [
    { id: 'uuid-o1', label: '学生', isManaged: true },
    { id: 'uuid-o2', label: '会社員', isManaged: true },
    { id: 'uuid-o3', label: 'エンジニア', isManaged: true },
  ],
  first_person: [
    { id: 'uuid-f1', label: '私', isManaged: true },
    { id: 'uuid-f2', label: '僕', isManaged: true },
  ],
};

const findPresetFromDb = (id: string | undefined, category: 'speech' | 'occupation' | 'first_person'): ManagedPreset | undefined => {
  if (!id) return undefined;
  return MOCK_PRESETS_DB[category].find(p => p.id === id);
};
// --- (ここまで) resident-form.tsx からモックデータとヘルパーを一時的に拝借 ---

// --- (ここから) traits の日本語ラベルと表示用コンポーネント ---
const DEFAULT_TRAITS = {
  sociability: 3,    // 社交性
  empathy: 3,        // 気配り
  stubbornness: 3,   // 頑固さ
  activity: 3,       // 行動力
  expressiveness: 3, // 表現力
} as const;

const TRAIT_LABELS: Record<keyof typeof DEFAULT_TRAITS, string> = {
  sociability: '社交性',
  empathy: '気配り',
  stubbornness: '頑固さ',
  activity: '行動力',
  expressiveness: '表現力',
};

// ★ 表示用の簡易レーティングボックス
const RatingBoxDisplay = ({ value }: { value: number }) => (
  <div className="flex space-x-1">
    {Array.from({ length: 5 }).map((_, index) => (
      <div
        key={index}
        className={`h-5 w-5 rounded
          ${index < value
            ? 'bg-primary text-primary-foreground' // アクティブなボックス
            : 'bg-neutral-200 dark:bg-neutral-700' // 非アクティブなボックス
          }
        `}
      />
    ))}
  </div>
);
// --- (ここまで) traits の日本語ラベルと表示用コンポーネント ---

// --- (ここから) 表示用のヘルパーコンポーネント (ProfileRow) ---
// フォームのレイアウトに似せるため、ラベルと値を表示する行コンポーネント
const ProfileRow = ({ label, value, isBlock = false }: { label: string; value: React.ReactNode; isBlock?: boolean }) => {
  const displayValue = value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
    ? <span className="text-muted-foreground">（未設定）</span>
    : value;

  if (isBlock) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="text-sm">{displayValue}</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-x-6 gap-y-1">
      <dt className="col-span-12 md:col-span-3 text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="col-span-12 md:col-span-9 text-sm">{displayValue}</dd>
    </div>
  );
};
// --- (ここまで) 表示用のヘルパーコンポーネント (ProfileRow) ---

const RELATION_LABELS: Record<Relation['type'], string> = {
  none: '（なし）',
  friend: '友達',
  best_friend: '親友',
  lover: '恋人',
  family: '家族',
};

const FEELING_LABELS: Record<Feeling['label'], string> = {
  none: '（なし）',
  dislike: '苦手',
  curious: '気になる',
  maybe_like: '好きかも',
  like: '好き',
  love: '大好き',
  awkward: '気まずい',
};

export default function ResidentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const residentId = params.id;
  const { data: resident, isLoading } = useResident(residentId);
  // ★ 全住人リストを取得
  const { data: allResidents } = useResidents();
  const { data: relations } = useRelations();
  const { data: feelings } = useFeelings();
  const remove = useDeleteResident();

  // ID/名前マップと印象マップを作成
  const residentNameMap = useMemo(() => {
    if (!allResidents) return new Map<string, string>();
    return new Map(allResidents.map(r => [r.id, r.name ?? '（名前なし）']));
  }, [allResidents]);

  const relatedRelations = relations?.filter((relation) => [relation.a_id, relation.b_id].includes(residentId)) ?? [];
  const relatedFeelings = feelings?.filter((feeling) => feeling.from_id === residentId || feeling.to_id === residentId) ?? [];

  const feelingMap = useMemo(() => {
    if (!relatedFeelings) return new Map<string, Feeling['label']>();
    const map = new Map<string, Feeling['label']>();
    // この住人 (residentId) から相手 (to_id) への感情をマップする
    for (const feeling of relatedFeelings) {
      if (feeling.from_id === residentId) {
        map.set(feeling.to_id, feeling.label);
      }
    }
    return map;
  }, [relatedFeelings, residentId]);

  // ★ allResidents のロードも待つ
  if (isLoading || !allResidents) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> 読み込み中…
      </div>
    );
  }

  if (!resident) {
    return <p className="text-sm text-muted-foreground">住人が見つかりません。</p>;
  }

  // --- (ここから) プリセットIDからラベルを取得 ---
  const speechPreset = findPresetFromDb(resident.speechPreset, 'speech');
  const occupationPreset = findPresetFromDb(resident.occupation, 'occupation');
  const firstPersonPreset = findPresetFromDb(resident.firstPerson, 'first_person');

  const sleepProfile = (resident.sleepProfile ?? {}) as Partial<SleepProfile>;
  // ★ traits にデフォルト値をマージ (DBに traits が null の場合に対応)
  const traits = { ...DEFAULT_TRAITS, ...(resident.traits as any) };
  // --- (ここまで) プリセットIDからラベルを取得 ---

  // --- (ここから) 性別ラベルの定義 ---
  const GENDER_LABELS: Record<string, string> = {
    male: '男性',
    female: '女性',
    nonbinary: 'なし',
    other: 'その他',
  };
  // --- (ここまで) 性別ラベルの定義 ---


  return (
    <div className="space-y-6">
      {/* --- ヘッダー（ボタン類） --- */}
      <div className="flex items-center justify-between">
        <Button variant="outline" asChild>
          <Link href="/office/residents" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/office/residents/${resident.id}/edit`} className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              編集
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              // 削除確認ダイアログ
              if (!window.confirm('本当に削除してよろしいですか？')) return;
              remove.mutate(resident.id, {
                onSuccess: () => router.push('/office/residents'),
              });
            }}
            disabled={remove.isPending}
          >
            削除
          </Button>
        </div>
      </div>

      {/* --- 住人名 --- */}
      <h1 className="text-2xl font-bold">{resident.name}</h1>

      {/* --- タブ（詳細情報） --- */}
      <Tabs defaultValue="profile">
        {/* タブの構成を変更 */}
        <TabsList>
          <TabsTrigger value="profile">プロフィール</TabsTrigger>
          <TabsTrigger value="relations">関係</TabsTrigger>
          <TabsTrigger value="recent_changes">最近の変化</TabsTrigger>
        </TabsList>

        {/* 「プロフィール」タブ */}
        <TabsContent value="profile">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* 基本情報、会話 */}
            <div className="space-y-6">

              {/* 基本情報 */}
              <Card>
                <CardHeader>
                  <CardTitle>基本情報</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <dl className="space-y-3">
                    <ProfileRow label="性別" value={resident.gender ? GENDER_LABELS[resident.gender] : null} />
                    <ProfileRow label="年齢" value={resident.age} />
                    <ProfileRow label="職業" value={occupationPreset?.label} />
                  </dl>
                </CardContent>
              </Card>

              {/* 会話 */}
              <Card>
                <CardHeader>
                  <CardTitle>会話</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <dl className="space-y-3">
                    <ProfileRow label="一人称" value={firstPersonPreset?.label} />
                    <ProfileRow
                      label="口調"
                      value={
                        speechPreset ? (
                          <div className="flex flex-col">
                            <span>{speechPreset.label}</span>
                            {speechPreset.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {speechPreset.description}
                              </p>
                            )}
                          </div>
                        ) : null
                      }
                    />
                    <ProfileRow
                      label="興味・関心"
                      value={
                        resident.interests && resident.interests.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {resident.interests.map((interest) => (
                              <Badge key={interest} variant="secondary">
                                {interest}
                              </Badge>
                            ))}
                          </div>
                        ) : null
                      }
                    />
                  </dl>
                </CardContent>
              </Card>

            </div>

            {/* 睡眠、パーソナリティ */}
            <div className="space-y-6">

              {/* 睡眠 */}
              <Card>
                <CardHeader>
                  <CardTitle>睡眠</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <dl className="space-y-3">
                    <ProfileRow label="就寝" value={sleepProfile.baseBedtime ? `${parseInt(sleepProfile.baseBedtime.split(':')[0], 10)} 時頃` : null} />
                    <ProfileRow label="起床" value={sleepProfile.baseWakeTime ? `${parseInt(sleepProfile.baseWakeTime.split(':')[0], 10)} 時頃` : null} />
                  </dl>
                </CardContent>
              </Card>

              {/* パーソナリティ */}
              <Card>
                <CardHeader>
                  <CardTitle>パーソナリティ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {/* dl で全体を囲み、ProfileRow を使う */}
                  <dl className="space-y-4">
                    <ProfileRow label="MBTI" value={resident.mbti} />

                    {/* ProfileRow を使い、isBlock={true} でレイアウトを統一 */}
                    <ProfileRow
                      label="性格パラメータ"
                      isBlock={true}
                      value={
                        <div className="space-y-3 pt-1"> {/* pt-1 を追加 (ラベルとの間隔) */}
                          {(Object.keys(TRAIT_LABELS) as Array<keyof typeof TRAIT_LABELS>).map((key) => (
                            <div key={key} className="grid grid-cols-5 items-center gap-3">
                              <label className="col-span-2 text-sm">{TRAIT_LABELS[key]}</label>
                              <div className="col-span-3">
                                <RatingBoxDisplay value={traits[key]} />
                              </div>
                            </div>
                          ))}
                        </div>
                      }
                    />
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* 「関係」タブ */}
        <TabsContent value="relations">
          <Card>
            <CardHeader>
              <CardTitle>関係一覧</CardTitle>
            </CardHeader>
            <CardContent>
              {relatedRelations.length === 0 ? (
                <p className="text-sm text-muted-foreground">まだ関係が登録されていません。</p>
              ) : (
                <div className="space-y-2">
                  {relatedRelations.map((relation) => {
                    const partnerId = relation.a_id === residentId ? relation.b_id : relation.a_id;
                    const partnerName = residentNameMap.get(partnerId) ?? `ID: ${partnerId}`;
                    // この住人 (residentId) から相手 (partnerId) への印象を取得
                    const impression = feelingMap.get(partnerId);

                    // ★ (ここから) 日本語ラベル取得
                    const relationType = relation.type ?? 'none';
                    const relationLabel = RELATION_LABELS[relationType] ?? relationType;

                    const impressionKey = impression ?? 'none';
                    const impressionLabel = FEELING_LABELS[impressionKey] ?? impressionKey;
                    // ★ (ここまで) 日本語ラベル取得

                    return (
                      <div
                        key={relation.id}
                        className="flex items-center justify-between rounded border p-3"
                      >
                        <div className="flex flex-col md:flex-row md:items-center md:gap-6">
                          {/* 相手住人の名前 */}
                          <span className="font-medium">{partnerName}</span>

                          {/* 情報 (関係と印象) */}
                          <div className="flex flex-col md:flex-row md:gap-4 text-sm text-muted-foreground mt-1 md:mt-0">
                            <span>
                              関係：
                              {/* 値を text-foreground にしてラベルと区別 */}
                              <span className="ml-1 text-foreground">{relationLabel}</span>
                            </span>
                            <span>
                              印象：
                              <span className="ml-1 text-foreground">{impressionLabel}</span>
                            </span>
                          </div>
                        </div>

                        {/* 詳細ボタン */}
                        <Button variant="ghost" size="sm" asChild>
                          {/* TODO: 関係詳細画面のパスを指定する */}
                          <Link href={`/office/relations/${relation.id}`}> {/* 仮のパス */}
                            詳細
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 「最近の変化」タブ (中身は空) */}
        <TabsContent value="recent_changes">
          <Card>
            <CardHeader>
              <CardTitle>最近の変化</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">（ここに最近の変化やイベントログが表示されます）</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}