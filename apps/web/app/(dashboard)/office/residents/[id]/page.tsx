'use client';

import { useRouter } from 'next/navigation';
import { useResident, useDeleteResident } from '@/lib/data/residents';
import { useRelations } from '@/lib/data/relations';
import { useFeelings } from '@/lib/data/feelings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { ResidentForm } from '@/components/forms/resident-form'; // フォームを削除
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Pencil } from 'lucide-react'; // アイコンを追加
import Link from 'next/link'; // Linkを追加
import { SleepProfile } from '../../../../../../../packages/shared/logic/schedule'; // 型をインポート

// --- (ここから) resident-form.tsx からモックデータとヘルパーを一時的に拝借 ---
// (本来は共有ライブラリに置くべき)
type ManagedPreset = { id: string; label: string; description?: string | null; isManaged: boolean };

const MOCK_PRESETS_DB: Record<'speech' | 'occupation' | 'first_person', ManagedPreset[]> = {
  speech: [
    { id: 'uuid-s1', label: 'ていねい', description: '常に敬語を使い、相手を尊重する話し方。', isManaged: true },
    { id: 'uuid-s2', label: 'くだけた', description: '友人や親しい人との間で使われる、フレンドリーな話し方。', isManaged: true },
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


export default function ResidentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const residentId = params.id;
  const { data: resident, isLoading } = useResident(residentId);
  const { data: relations } = useRelations();
  const { data: feelings } = useFeelings();
  const remove = useDeleteResident();

  if (isLoading) {
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
  // --- (ここまで) プリセットIDからラベルを取得 ---


  const relatedRelations = relations?.filter((relation) => [relation.a_id, relation.b_id].includes(residentId)) ?? [];
  const relatedFeelings = feelings?.filter((feeling) => feeling.from_id === residentId || feeling.to_id === residentId) ?? [];

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
        {/* ★ タブの構成を変更 */}
        <TabsList>
          <TabsTrigger value="profile">プロフィール</TabsTrigger>
          <TabsTrigger value="relations">関係</TabsTrigger>
          <TabsTrigger value="recent_changes">最近の変化</TabsTrigger>
        </TabsList>

        {/* ★ 「プロフィール」タブ */}
        <TabsContent value="profile">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* 左側カラム (基本情報、会話、睡眠) */}
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

            </div>

            {/* 右側カラム (パーソナリティ) */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>パーソナリティ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <dl className="space-y-3">
                    <ProfileRow label="MBTI" value={resident.mbti} />

                    {/* 性格パラメータ (Traits) */}
                    {/* TODO: フォームの ClickableRatingBox のような表示系コンポーネントが望ましい */}
                    <ProfileRow
                      label="性格パラメータ"
                      isBlock={true}
                      value={
                        <pre className="mt-1 max-h-60 overflow-auto rounded bg-muted p-3 text-xs font-mono">
                          {JSON.stringify(resident.traits ?? {}, null, 2)}
                        </pre>
                      }
                    />
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ★ 「関係」タブ */}
        <TabsContent value="relations">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 関係一覧 */}
            <Card>
              <CardHeader>
                <CardTitle>関係一覧</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {relatedRelations.length === 0 && <p className="text-muted-foreground">まだ関係が登録されていません。</p>}
                {relatedRelations.map((relation) => {
                  const partnerId = relation.a_id === residentId ? relation.b_id : relation.a_id;
                  return (
                    <div key={relation.id} className="flex items-center justify-between rounded border p-2">
                      <span>相手ID: {partnerId}</span>
                      <Badge>{relation.type}</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* ★ 感情ラベル (ここに移動) */}
            <Card>
              <CardHeader>
                <CardTitle>感情ラベル</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {relatedFeelings.length === 0 && <p className="text-muted-foreground">まだ感情が登録されていません。</p>}
                {relatedFeelings.map((feeling) => (
                  <div key={feeling.id} className="rounded border p-2">
                    <p>
                      {feeling.from_id === residentId ? 'この住人 → 相手' : '相手 → この住人'} :{' '}
                      <Badge>{feeling.label}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">相手ID: {feeling.from_id === residentId ? feeling.to_id : feeling.from_id}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ★ 「最近の変化」タブ (中身は空) */}
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