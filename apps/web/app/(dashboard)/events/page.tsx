'use client';

import { useEvents, useAddEvent } from '@/lib/data/events';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

export default function EventsPage() {
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useEvents();
  const addEvent = useAddEvent();
  const [kind, setKind] = useState('manual_log');
  const [payload, setPayload] = useState('{"message":"同期テスト"}');

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">イベントログ</h1>
      <Card>
        <CardHeader>
          <CardTitle>手動でイベントを追加</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={kind} onChange={(event) => setKind(event.target.value)} placeholder="イベント種別" />
          <Textarea value={payload} onChange={(event) => setPayload(event.target.value)} rows={4} />
          <Button
            onClick={() => {
              try {
                const parsed = JSON.parse(payload);
                addEvent.mutate({ kind, payload: parsed });
              } catch (error) {
                alert('JSONを正しく入力してください');
              }
            }}
            disabled={addEvent.isPending}
          >
            追加
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>最新イベント</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((event) => (
            <div key={event.id} className="space-y-1 rounded border p-3 text-sm">
              <p className="font-semibold">{event.kind}</p>
              <pre className="overflow-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
              <p className="text-xs text-muted-foreground">更新日時: {new Date(event.updated_at).toLocaleString()}</p>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground">まだイベントがありません。</p>}
          {hasNextPage && (
            <Button variant="secondary" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? '読み込み中…' : 'さらに読み込む'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
