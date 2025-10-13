'use client';

import { useResidents, useDeleteResident } from '@/lib/data/residents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2, Plus } from 'lucide-react';

export default function ResidentsPage() {
  const { data, isLoading } = useResidents();
  const remove = useDeleteResident();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">住人一覧</h1>
        <Button asChild>
          <Link href="/residents/new" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            新規追加
          </Link>
        </Button>
      </div>
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />読み込み中…
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {data?.map((resident) => (
          <Card key={resident.id} className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle>{resident.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">MBTI: {resident.mbti ?? '未設定'}</p>
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link href={`/residents/${resident.id}`}>詳細</Link>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => remove.mutate(resident.id)}
                  disabled={remove.isPending}
                >
                  削除
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {data?.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">まだ住人がいません。右上のボタンから追加しましょう。</p>
        )}
      </div>
    </div>
  );
}
