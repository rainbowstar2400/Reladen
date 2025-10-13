'use client';

import { useFeelings, useUpsertFeeling } from '@/lib/data/feelings';
import { useResidents } from '@/lib/data/residents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const FEELING_LABELS = ['none', 'dislike', 'curious', 'maybe_like', 'like', 'love', 'awkward'] as const;
type FeelingLabel = (typeof FEELING_LABELS)[number];

export default function FeelingsPage() {
  const { data: feelings } = useFeelings();
  const { data: residents } = useResidents();
  const upsert = useUpsertFeeling();
  const [formState, setFormState] = useState<{ from_id: string; to_id: string; label: FeelingLabel }>(
    { from_id: '', to_id: '', label: 'curious' }
  );

  const residentName = (id: string) => residents?.find((r) => r.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">感情ラベル</h1>
      <Card>
        <CardHeader>
          <CardTitle>感情を登録</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              placeholder="FromのUUID"
              value={formState.from_id}
              onChange={(event) => setFormState((prev) => ({ ...prev, from_id: event.target.value }))}
            />
            <Input
              placeholder="ToのUUID"
              value={formState.to_id}
              onChange={(event) => setFormState((prev) => ({ ...prev, to_id: event.target.value }))}
            />
          </div>
          <Select
            value={formState.label}
            onValueChange={(value) => setFormState((prev) => ({ ...prev, label: value as FeelingLabel }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="感情ラベル" />
            </SelectTrigger>
            <SelectContent>
              {FEELING_LABELS.map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              if (!formState.from_id || !formState.to_id) return;
              upsert.mutate(formState);
            }}
            disabled={upsert.isPending}
          >
            追加 / 更新
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>登録済み</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(feelings ?? []).map((feeling) => (
            <div key={feeling.id} className="flex flex-col gap-2 rounded border p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {residentName(feeling.from_id)} → {residentName(feeling.to_id)}
                </p>
                <p className="text-xs text-muted-foreground">更新日時: {new Date(feeling.updated_at).toLocaleString()}</p>
              </div>
              <Select
                value={feeling.label as FeelingLabel}
                onValueChange={(value) => upsert.mutate({ ...feeling, label: value as FeelingLabel })}
              >
                <SelectTrigger className="md:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEELING_LABELS.map((label) => (
                    <SelectItem key={label} value={label}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {(feelings?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">まだ登録された感情がありません。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
