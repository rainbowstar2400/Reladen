'use client';

import { ResidentForm } from '@/components/forms/resident-form';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
// ★ 追加: useQuery とローカルDBフック
import { useQuery } from '@tanstack/react-query';
import { getLocal, listLocal } from '@/lib/db-local';
// ★ 追加: 関連する型をインポート
import type {
  Resident,
  ResidentWithRelations,
  Relation,
  Feeling,
  Nickname,
} from '@/types';

export default function EditResidentPage({ params }: { params: { id: string } }) {
  const residentId = params.id;

  // ★ 変更: useResident() の代わりに、関連データもすべて取得する useQuery を使用
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

      // 3. ResidentWithRelations の型 に合わせてデータを組み立てる
      const data: ResidentWithRelations = {
        ...resident,
        relations: allRelations.filter((r) => r.a_id === residentId),
        feelingsFrom: allFeelings.filter((f) => f.from_id === residentId),
        feelingsTo: allFeelings.filter((f) => f.to_id === residentId),
        nicknamesTo: allNicknames.filter((n) => n.from_id === residentId),
        nicknamesFrom: allNicknames.filter((n) => n.to_id === residentId),
      };
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <Button variant="outline" asChild>
        {/* 詳細ページに戻るリンク */}
        <Link href={`/office/residents/${residentId}`} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          詳細に戻る
        </Link>
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
  );
}