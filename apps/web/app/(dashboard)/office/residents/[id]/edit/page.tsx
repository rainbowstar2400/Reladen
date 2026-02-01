'use client';

import { ResidentForm } from '@/components/forms/resident-form';
import { Loader2, ArrowLeft } from 'lucide-react';
import { SafeLink } from '@/components/layout/SafeLink';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { getLocal, listLocal } from '@/lib/db-local';
import { DeskPanel } from '@/components/room/desk-panel';
import { OfficePanelShell } from '@/components/room/office-panel-shell';
import type {
  Resident,
  ResidentWithRelations,
  Relation,
  Feeling,
  Nickname,
} from '@/types';

export default function EditResidentPage({ params }: { params: { id: string } }) {
  const residentId = params.id;

  // useResident() の代わりに、関連データもすべて取得する useQuery を使用
  const { data: residentData, isLoading } = useQuery({
    queryKey: ['residentWithRelations', residentId], // このページ専用のクエリキー
    queryFn: async (): Promise<ResidentWithRelations | null> => {
      // 1. 基本の住民データを取得
      const resident = await getLocal<Resident>('residents', residentId);
      if (!resident) return null;

      // 2. 関連データをすべて取得
      const allRelations = await listLocal<Relation>('relations');
      const allFeelings = await listLocal<Feeling>('feelings');
      const allNicknames = await listLocal<Nickname>('nicknames');

      const normalizedRelations = allRelations
        .filter((r) => r.a_id === residentId || r.b_id === residentId)
        .map((r) =>
          r.a_id === residentId
            ? r
            : { ...r, a_id: residentId, b_id: r.a_id }
        );

      // 3. ResidentWithRelations の型 に合わせてデータを組み立てる
      const data: ResidentWithRelations = {
        ...resident,
        relations: normalizedRelations,
        feelingsFrom: allFeelings.filter((f) => f.from_id === residentId),
        feelingsTo: allFeelings.filter((f) => f.to_id === residentId),
        nicknamesTo: allNicknames.filter((n) => n.from_id === residentId),
        nicknamesFrom: allNicknames.filter((n) => n.to_id === residentId),
      };
      return data;
    },
  });

  return (
    <DeskPanel className="mx-auto mt-[clamp(24px,3vw,56px)] w-[min(100%,960px)]">
      <OfficePanelShell showTitle={false}>
        <div className="space-y-6">
          <Button variant="outline" asChild>
            {/* 詳細ページに戻るリンク */}
            <SafeLink href={`/office/residents/${residentId}`} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              詳細に戻る
            </SafeLink>
          </Button>

          <h1 className="text-2xl font-bold">住人情報の編集</h1>

          {/* データ読み込み中にローダーを表示 */}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              読み込み中…
            </div>
          )}

          {/* 読み込み完了後、フォームに defaultValues を渡して表示 */}
          {residentData && (
            <ResidentForm defaultValues={residentData} />
          )}

          {/* データが見つからない場合の表示 */}
          {!residentData && !isLoading && (
            <div>住人が見つかりません。</div>
          )}
        </div>
      </OfficePanelShell>
    </DeskPanel>
  );
}
