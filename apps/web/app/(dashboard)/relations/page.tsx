'use client';

import { useRelations, useUpsertRelation } from '@/lib/data/relations';
import { useResidents } from '@/lib/data/residents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

const RELATION_TYPES = ['none', 'friend', 'best_friend', 'lover', 'family'] as const;
type RelationType = (typeof RELATION_TYPES)[number];

export default function RelationsPage() {
  const { data: relations } = useRelations();
  const { data: residents } = useResidents();
  const upsert = useUpsertRelation();
  const [formState, setFormState] = useState<{ a_id: string; b_id: string; type: RelationType }>({
    a_id: '',
    b_id: '',
    type: 'friend',
  });

  const residentName = (id: string) => residents?.find((r) => r.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">関係ラベル</h1>
      <Card>
        <CardHeader>
          <CardTitle>新しい関係を登録</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              placeholder="AのUUID"
              value={formState.a_id}
              onChange={(event) => setFormState((prev) => ({ ...prev, a_id: event.target.value }))}
            />
            <Input
              placeholder="BのUUID"
              value={formState.b_id}
              onChange={(event) => setFormState((prev) => ({ ...prev, b_id: event.target.value }))}
            />
          </div>
          <Select
            value={formState.type}
            onValueChange={(value) => setFormState((prev) => ({ ...prev, type: value as RelationType }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="関係種別" />
            </SelectTrigger>
            <SelectContent>
              {RELATION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              if (!formState.a_id || !formState.b_id) return;
              upsert.mutate({ ...formState });
            }}
            disabled={upsert.isPending}
          >
            追加 / 更新
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>関係一覧</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(relations ?? []).map((relation) => (
            <div key={relation.id} className="flex flex-col gap-2 rounded border p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {residentName(relation.a_id)} ⇄ {residentName(relation.b_id)}
                </p>
                <p className="text-xs text-muted-foreground">更新日時: {new Date(relation.updated_at).toLocaleString()}</p>
              </div>
              <Select
                value={relation.type as RelationType}
                onValueChange={(value) => upsert.mutate({ ...relation, type: value as RelationType })}
              >
                <SelectTrigger className="md:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          {(relations?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">まだ登録された関係がありません。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
