'use client';

import { useRelation } from '@/lib/data/relations';
import { replaceResidentIds, useResident } from '@/lib/data/residents';
import { useFeelings } from '@/lib/data/feelings';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ChevronsLeftRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useNicknames } from '@/lib/data/nicknames';
import { Feeling, Relation, Nickname } from '@/types';
import { useEvents } from '@/lib/data/events'; // 追加
import { EventLog } from '@/types'; // EventLog をインポート
import {
    isConversationPayload,
    toJstDateKey,
    ConversationPayloadStrict
} from '@/lib/repos/conversation-repo'; //
import { FEELING_LABELS, RELATION_LABELS } from '@/lib/constants/labels';

const AffinityBar = ({ value }: { value: number }) => {
    // -100 から 0 は左側、0 〜 100 は右側へ伸ばす積み上げ型のバー
    const clamped = Math.max(-100, Math.min(100, value));
    const segments = 20; // 10pt 刻みで 20 分割
    const filledRatio = (clamped + 100) / 200; // 0.0 〜 1.0
    const fullBoxes = Math.floor(filledRatio * segments);
    const partial = filledRatio * segments - fullBoxes; // 0.0 〜 1.0

    return (
        <div className="flex space-x-0.5">
            {Array.from({ length: segments }).map((_, index) => {
                const widthPercent =
                    index < fullBoxes
                        ? 100
                        : index === fullBoxes && fullBoxes < segments
                            ? Math.round(partial * 100)
                            : 0;

                return (
                    <div
                        key={index}
                        className="h-4 flex-1 rounded-xs bg-neutral-200 dark:bg-neutral-700 overflow-hidden"
                    >
                        {/* 内側のバー (塗りつぶし) */}
                        <div
                            className="h-4 bg-foreground"
                            style={{ width: `${widthPercent}%` }}
                        />
                    </div>
                );
            })}
        </div>
    );
};

// 左右対比の表示列コンポーネント
const InfoColumn = ({
    title,
    impression,
    affinity, // -100 〜 100 の数値
    callName,
}: {
    title: string;
    impression: Feeling['label'] | null;
    affinity: number;
    callName: string | null;
}) => (
    <div className="flex-1 space-y-3">
        <h3 className="text-center font-medium">{title}</h3>
        <dl className="space-y-3 text-sm p-4 rounded border">

            {/* 印象 */}
            <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">印象：</dt>
                <dd>
                    {impression ? (
                        <Badge variant="secondary">{FEELING_LABELS[impression] ?? impression}</Badge>
                    ) : (
                        'なし'
                    )}
                </dd>
            </div>

            {/* 好感度 */}
            <div className="flex items-center justify-between gap-4 pt-1">
                <dt className="text-muted-foreground whitespace-nowrap">好感度：</dt>
                <dd className="flex-1">
                    <AffinityBar value={affinity} />
                </dd>
            </div>

            {/* 呼び方 */}
            <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">呼び方：</dt>
                <dd>{callName ?? '（未設定）'}</dd>
            </div>
        </dl>
    </div>
);

export default function RelationDetailPage({ params }: { params: { id: string } }) {
    const relationId = params.id;
    const { data: relation, isLoading: isLoadingRelation } = useRelation(relationId);

    // relation がないと a_id, b_id がわからないので、relation がロードされてからフェッチする
    const residentAId = relation?.a_id;
    const residentBId = relation?.b_id;

    // useResident フックは residentId が undefined だと実行されないように調整
    const { data: residentA, isLoading: isLoadingA } = useResident(residentAId);
    const { data: residentB, isLoading: isLoadingB } = useResident(residentBId);
    const { data: feelings, isLoading: isLoadingFeelings } = useFeelings();
    const { data: nicknames, isLoading: isLoadingNicknames } = useNicknames();

    const { data: eventsData, isLoading: isLoadingEvents } = useEvents();

    // A->B, B->A の情報を整理
    const { a_to_b, b_to_a } = useMemo(() => {
        if (!residentAId || !residentBId || !feelings || !nicknames) {
            const defaultData = {
                impression: null,
                affinity: 0,
                callName: null,
            };
            return { a_to_b: defaultData, b_to_a: defaultData };
        }

        const a_to_b_feeling = feelings.find(f => f.from_id === residentAId && f.to_id === residentBId);
        const b_to_a_feeling = feelings.find(f => f.from_id === residentBId && f.to_id === residentAId);

        // ニックネームを検索 (スキーマ定義に合わせて fromId, toId を使用)
        const a_to_b_nickname = nicknames.find(n => n.from_id === residentAId && n.to_id === residentBId);
        const b_to_a_nickname = nicknames.find(n => n.from_id === residentBId && n.to_id === residentAId);

        return {
            a_to_b: {
                impression: a_to_b_feeling?.label ?? null,
                affinity: a_to_b_feeling?.score ?? 0, // (feelings の修正)
                callName: a_to_b_nickname?.nickname ?? null,
            },
            b_to_a: {
                impression: b_to_a_feeling?.label ?? null,
                affinity: b_to_a_feeling?.score ?? 0, // (feelings の修正)
                callName: b_to_a_nickname?.nickname ?? null,
            },
        };
    }, [residentAId, residentBId, feelings, nicknames]);

    const relatedEvents = useMemo(() => {
        if (!eventsData || !residentAId || !residentBId) {
            return [];
        }

        const allEvents = eventsData.pages.flatMap(page => page.items);

        const filtered = allEvents.filter(event => {
            // conversation-repo.ts の isConversationPayload を使う
            if (event.kind === 'conversation' && isConversationPayload(event.payload)) {
                const participants = (event.payload as ConversationPayloadStrict).participants;
                const hasA = participants.includes(residentAId);
                const hasB = participants.includes(residentBId);
                return hasA && hasB;
            }
            // TODO: 'consult' など他の種類のイベントも対象にする場合はここに追加
            return false;
        });

        // useEvents は既にソート済みのはずだが、flatMapで順序が変わる場合に備えて再ソート
        return filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    }, [eventsData, residentAId, residentBId]);

    const isLoading = isLoadingRelation || isLoadingA || isLoadingB || isLoadingFeelings || isLoadingEvents || isLoadingNicknames;

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

    const residentNameMap: Record<string, string> = {
        [residentA.id]: nameA,
        [residentB.id]: nameB,
    };

    // 関係タイプを日本語に変換 (デフォルトは 'none' 扱い)
    const relationType = relation.type ?? 'none';
    const relationLabel = RELATION_LABELS[relationType] ?? '（未設定）';

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
            <Card className="max-w-xs mx-auto">
                <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-base font-medium text-muted-foreground">関係</p>
                    <p className="text-lg font-semibold">
                        {relationLabel}
                    </p>
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
                    {isLoadingEvents ? (
                        <p className="text-sm text-muted-foreground">履歴を読み込み中...</p>
                    ) : relatedEvents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            （ {nameA} と {nameB} の間の会話や変化はまだありません）
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {/* 直近5件程度に絞る */}
                            {relatedEvents.slice(0, 5).map(event => {
                                // conversation-repo.ts のヘルパー関数で日付をフォーマット
                                const { dateLabel, timeLabel } = toJstDateKey(event.updated_at);
                                const payload = event.payload as ConversationPayloadStrict; //

                                return (
                                    <li key={event.id} className="text-sm border-b pb-2">
                                        <p className="font-medium">
                                            {dateLabel} {timeLabel}
                                        </p>
                                        <p className="text-muted-foreground truncate">
                                            {payload.systemLine
                                                ? replaceResidentIds(payload.systemLine, residentNameMap)
                                                : (payload.lines[0]?.text ?? '会話')}
                                        </p>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}