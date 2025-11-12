'use client';

import { useRelation } from '@/lib/data/relations';
import { useResident } from '@/lib/data/residents';
import { useFeelings } from '@/lib/data/feelings';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ChevronsLeftRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Feeling } from '@/types'; // ★ Feeling 型をインポート

// ★ (ここから) 好感度バーのダミーコンポーネント
// (現在のスキーマに好感度がないため、ダミーで表示します)
const AffinityBar = ({ value }: { value: number }) => (
    <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2.5">
        <div
            className="bg-blue-600 h-2.5 rounded-full"
            style={{ width: `${value}%` }}
        />
    </div>
);
// ★ (ここまで) 好感度バーのダミーコンポーネント

// ★ (ここから) 左右対比の表示列コンポーネント
const InfoColumn = ({
    title,
    impression,
    affinity, // 0-100 の数値
    callName,
}: {
    title: string;
    impression: Feeling['label'] | null;
    affinity: number;
    callName: string | null;
}) => (
    <div className="flex-1 space-y-3">
        <h3 className="text-center font-medium">{title}</h3>
        <dl className="space-y-4 text-sm p-4 rounded border">
            <div className="space-y-1">
                <dt className="text-muted-foreground">印象</dt>
                <dd>
                    {impression ? (
                        <Badge variant="secondary">{impression}</Badge>
                    ) : (
                        '（なし）'
                    )}
                </dd>
            </div>
            <div className="space-y-1">
                <dt className="text-muted-foreground">好感度 ({affinity})</dt>
                <dd>
                    <AffinityBar value={affinity} />
                </dd>
            </div>
            <div className="space-y-1">
                <dt className="text-muted-foreground">呼び方</dt>
                <dd>{callName ?? '（未設定）'}</dd>
            </div>
        </dl>
    </div>
);
// ★ (ここまで) 左右対比の表示列コンポーネント

export default function RelationDetailPage({ params }: { params: { id: string } }) {
    const relationId = params.id;
    const { data: relation, isLoading: isLoadingRelation } = useRelation(relationId);

    // relation がないと a_id, b_id がわからないので、relation がロードされてからフェッチする
    const residentAId = relation?.a_id;
    const residentBId = relation?.b_id;

    // useResident フックは residentId が undefined だと実行されないように調整
    const { data: residentA, isLoading: isLoadingA } = useResident(residentAId!);
    const { data: residentB, isLoading: isLoadingB } = useResident(residentBId!);

    const { data: feelings, isLoading: isLoadingFeelings } = useFeelings();

    // ★ A->B, B->A の情報を整理
    const { a_to_b, b_to_a } = useMemo(() => {
        if (!residentAId || !residentBId || !feelings) {
            const defaultData = {
                impression: null,
                affinity: 0,
                callName: null,
            };
            return { a_to_b: defaultData, b_to_a: defaultData };
        }

        const a_to_b_feeling = feelings.find(f => f.from_id === residentAId && f.to_id === residentBId);
        const b_to_a_feeling = feelings.find(f => f.from_id === residentBId && f.to_id === residentAId);

        // TODO: 好感度 (affinity) と 呼び方 (callName) は現在ダミーデータ
        // これらは Relation テーブルのスキーマを拡張して保存する必要がある

        return {
            a_to_b: {
                impression: a_to_b_feeling?.label ?? null,
                affinity: 60, // ダミー
                callName: null, // ダミー (Bの名前を表示するかもしれないが、スキーマにない)
            },
            b_to_a: {
                impression: b_to_a_feeling?.label ?? null,
                affinity: 80, // ダミー
                callName: null, // ダミー
            },
        };
    }, [residentAId, residentBId, feelings]);


    const isLoading = isLoadingRelation || isLoadingA || isLoadingB || isLoadingFeelings;

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 読み込み中…
            </div>
        );
    }

    if (!relation || !residentA || !residentB) {
        return <p className="text-sm text-muted-foreground">関係データが見つかりません。</p>;
    }

    const nameA = residentA.name ?? '住人A';
    const nameB = residentB.name ?? '住人B';

    return (
        <div className="space-y-6">
            {/* --- ヘッダー（戻るボタン） --- */}
            <div className="flex items-center justify-between">
                <Button variant="outline" asChild>
                    {/* 戻り先は住人詳細（どちらか）または関係一覧 */}
                    <Link href={`/office/residents/${residentA.id}`} className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        {nameA} の詳細に戻る
                    </Link>
                </Button>
            </div>

            {/* --- タイトル (A ⇄ B) --- */}
            <div className="flex items-center justify-center gap-4">
                <h1 className="text-2xl font-bold">{nameA}</h1>
                <ChevronsLeftRight className="h-6 w-6 text-muted-foreground" />
                <h1 className="text-2xl font-bold">{nameB}</h1>
            </div>

            {/* --- 共通の関係 --- */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-center text-base font-medium text-muted-foreground">関係</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-lg font-semibold">
                    {relation.type ?? '（未設定）'}
                </CardContent>
            </Card>

            {/* --- 左右対比 (A->B, B->A) --- */}
            <div className="flex flex-col md:flex-row gap-6">
                <InfoColumn
                    title={`${nameA} → ${nameB}`}
                    impression={a_to_b.impression}
                    affinity={a_to_b.affinity}
                    callName={a_to_b.callName}
                />
                <InfoColumn
                    title={`${nameB} → ${nameA}`}
                    impression={b_to_a.impression}
                    affinity={b_to_a.affinity}
                    callName={b_to_a.callName}
                />
            </div>

            {/* --- 直近の関わり --- */}
            <Card>
                <CardHeader>
                    <CardTitle>直近の関わり</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        （ {nameA} と {nameB} の間の会話ログやイベントが表示されます - 未実装）
                    </p>
                    {/* TODO: 
            1. useEvents() や useConversations() でログを取得
            2. participants に A と B が両方含まれるものをフィルタリング
            3. 時系列で表示
          */}
                </CardContent>
            </Card>
        </div>
    );
}