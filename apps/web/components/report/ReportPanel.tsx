'use client';

import * as React from 'react';
import { listConversationEventsByDate } from '@/lib/repos/conversation-repo';
import type { ConversationDayGroup } from '@/lib/repos/conversation-repo';
import { useRouter } from 'next/navigation';
import DeltaChip from './DeltaChip';
import { useResidentNameMap } from '@/lib/data/residents';

/**
 * 日報パネル（会話まとめ）
 */
export default function ReportPanel() {
    const [groups, setGroups] = React.useState<ConversationDayGroup[]>([]);
    const [loading, setLoading] = React.useState(true);
    const router = useRouter();
    const residentNameMap = useResidentNameMap();

    React.useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const data = await listConversationEventsByDate({ limitDays: 7 });
                setGroups(data);
            } catch (err) {
                console.error('日報データ取得失敗:', err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleOpenLog = (eventId: string) => {
        const url = new URL(window.location.href);
        url.searchParams.set('log', eventId);
        router.push(url.pathname + '?' + url.searchParams.toString());
    };

    if (loading) {
        return (
            <div className="rounded-2xl border bg-white p-4 text-sm text-gray-500">
                日報を読み込み中…
            </div>
        );
    }

    if (groups.length === 0) {
        return (
            <div className="rounded-2xl border bg-white p-4 text-sm text-gray-500">
                会話イベントはまだありません。
            </div>
        );
    }

    return (
        <div className="rounded-2xl border bg-white">
            <div className="px-4 py-3 border-b font-semibold">今日のレポート</div>
            <div className="divide-y">
                {groups.map((g) => (
                    <section key={g.dateKey} className="p-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">
                            {g.dateLabel}（{g.weekday}）
                        </h3>
                        <ul className="space-y-1">
                            {g.items.map((it) => {
                                const participantA = residentNameMap[it.participants[0]] ?? it.participants[0];
                                const participantB = residentNameMap[it.participants[1]] ?? it.participants[1];

                                return (
                                    <li
                                        key={it.id}
                                        className="text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-1 hover:bg-gray-50 p-2 rounded-lg cursor-pointer transition"
                                        onClick={() => handleOpenLog(it.id)}
                                    >
                                        <div>
                                            <span className="font-medium text-gray-800">
                                                {participantA} ↔ {participantB}
                                            </span>
                                            <span className="ml-2 text-gray-500 text-xs">
                                                {it.timeLabel}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className="text-[11px] text-gray-400 mr-1">A→B</span>
                                            <DeltaChip variant="favor" value={it.deltas.aToB.favor} size="sm" />
                                            <DeltaChip variant="impression" value={it.deltas.aToB.impression} size="sm" />
                                            <span className="text-[11px] text-gray-400 mx-2">/</span>
                                            <span className="text-[11px] text-gray-400 mr-1">B→A</span>
                                            <DeltaChip variant="favor" value={it.deltas.bToA.favor} size="sm" />
                                            <DeltaChip variant="impression" value={it.deltas.bToA.impression} size="sm" />
                                        </div>
                                        {it.systemLine && (
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                {it.systemLine}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))}
            </div>
        </div>
    );
}

/** 表示補助 */
function fmtFavor(d: ConversationDayGroup['items'][number]['deltas']) {
    const val = d.aToB.favor; // a→b のみ代表表示
    if (val > 0) return `+${val} ↑`;
    if (val < 0) return `${val} ↓`;
    return '±0';
}

function fmtImpression(d: ConversationDayGroup['items'][number]['deltas']) {
    const val = d.aToB.impression;
    if (!val || val === 'none') return '→';
    return val;
}
