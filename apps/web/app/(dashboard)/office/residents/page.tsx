'use client';

import { useResidents, useDeleteResident } from '@/lib/data/residents';
import { Card, CardContent } from '@/components/ui/card'; // CardHeader, CardTitle を削除
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2, Plus } from 'lucide-react';
import { DeskPanel } from '@/components/room/desk-panel';
import { OfficePanelShell } from '@/components/room/office-panel-shell';

export default function ResidentsPage() {
  const { data, isLoading } = useResidents();
  const remove = useDeleteResident();

  return (
    <DeskPanel className="mx-auto mt-[clamp(24px,3vw,56px)] w-[min(100%,960px)]">
      <OfficePanelShell title="住人一覧">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button
              asChild
              className="!border-white/65 !bg-white/34 !text-white/95 !shadow-[0_10px_18px_rgba(6,18,32,0.16)] hover:!bg-white/38"
            >
              <Link
                href="/office/new"
                className="flex items-center gap-2"
                style={{
                  backgroundImage: 'none',
                  backgroundColor: 'rgba(255,255,255,0.34)',
                  border: '1px solid rgba(255,255,255,0.65)',
                  boxShadow: '0 10px 18px rgba(6,18,32,0.16)',
                }}
              >
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
          {/* レイアウトをグリッドからリスト（space-y）に変更 */}
          <div className="space-y-4">
            {data?.map((resident) => (
              <Card key={resident.id}>
                {/* CardContent を flex レイアウトに変更 */}
                <CardContent className="flex items-center justify-between p-4">
                  {/* 名前 */}
                  <div className="font-medium">{resident.name}</div>
                  {/* ボタン群（詳細、編集、削除） */}
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/office/residents/${resident.id}`}>詳細</Link>
                    </Button>
                    {/* 編集ボタンを追加（リンク先は詳細ページ） */}
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/office/residents/${resident.id}/edit`}>編集</Link>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        // 削除確認ダイアログを追加
                        if (window.confirm('本当に削除してよろしいですか？')) {
                          remove.mutate(resident.id);
                        }
                      }}
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
      </OfficePanelShell>
    </DeskPanel>
  );
}
