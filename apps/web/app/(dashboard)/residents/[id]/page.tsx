'use client';

import { useParams, useRouter } from 'next/navigation';
import { useResident, useDeleteResident } from '@/lib/data/residents';
import { useRelations } from '@/lib/data/relations';
import { useFeelings } from '@/lib/data/feelings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResidentForm } from '@/components/forms/resident-form';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export default function ResidentDetailPage() {
  const params = useParams<{ id: string }>();
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
    return <p className="text-sm text-muted-foreground">住人が見つかりませんでした。</p>;
  }

  const relatedRelations = relations?.filter((relation) => [relation.a_id, relation.b_id].includes(residentId)) ?? [];
  const relatedFeelings = feelings?.filter((feeling) => feeling.from_id === residentId || feeling.to_id === residentId) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{resident.name}</h1>
        <Button
          variant="destructive"
          onClick={() => {
            remove.mutate(resident.id, {
              onSuccess: () => router.push('/residents'),
            });
          }}
        >
          削除
        </Button>
      </div>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">プロフィール</TabsTrigger>
          <TabsTrigger value="relations">関係</TabsTrigger>
          <TabsTrigger value="feelings">感情</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>MBTI: {resident.mbti ?? '未設定'}</p>
              <div>
                <p className="font-medium">特徴</p>
                <pre className="mt-2 max-h-60 overflow-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(resident.traits ?? {}, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="relations">
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
        </TabsContent>
        <TabsContent value="feelings">
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
        </TabsContent>
      </Tabs>
      <Card>
        <CardHeader>
          <CardTitle>編集</CardTitle>
        </CardHeader>
        <CardContent>
          <ResidentForm defaultValues={resident} />
        </CardContent>
      </Card>
    </div>
  );
}
