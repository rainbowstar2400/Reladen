'use client';

import { ResidentForm } from '@/components/forms/resident-form';
import { useResident } from '@/lib/data/residents'; // データ取得フック
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function EditResidentPage({ params }: { params: { id: string } }) {
  const residentId = params.id;
  
  // ID に基づいて住人データを取得
  const { data: resident, isLoading } = useResident(residentId);

  return (
    <div className="space-y-6">
      <Button variant="outline" asChild>
        {/* 詳細ページに戻るリンク */}
        <Link href={`/office/residents/[id]`} className="flex items-center gap-2">
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
      {resident && (
        <ResidentForm defaultValues={resident} />
      )}

      {/* データが見つからない場合の表示 */}
      {!resident && !isLoading && (
        <div>住人が見つかりません。</div>
      )}
    </div>
  );
}