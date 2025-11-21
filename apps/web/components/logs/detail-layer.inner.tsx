'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import LogDetailPanel, { LogDetail } from '@/components/logs/log-detail-panel';
import { fetchEventById } from '@/lib/data/notifications';
import type { EventLogStrict } from '@repo/shared/types/conversation';
import { useResidentNameMap } from '@/lib/data/residents';

/** 会話ペイロード（Union回避用の厳密型） */
type ConversationPayloadStrict = {
  threadId: string;
  participants: [string, string];
  lines: { speaker: string; text: string }[];
  meta: {
    tags: string[];
    newKnowledge: { target: string; key: string }[];
    signals?: ('continue' | 'close' | 'park')[];
    qualityHints?: Record<string, unknown>;
  };
  deltas: {
    aToB: { favor: number; impression: number };
    bToA: { favor: number; impression: number };
  };
  systemLine: string;
  topic?: string;
};

/** payloadが会話イベントか判定 */
function isConversationPayload(p: unknown): p is ConversationPayloadStrict {
  const g = p as ConversationPayloadStrict | undefined;
  return !!g
    && typeof g.threadId === 'string'
    && Array.isArray(g.participants)
    && g.participants.length === 2
    && Array.isArray(g.lines);
}

/** Entity → EventLogStrict かどうかを判定（kind/payload を持つ） */
function isEventLogStrict(x: unknown): x is EventLogStrict {
  const e = x as EventLogStrict | undefined;
  return !!e && typeof e === 'object' && 'kind' in e && 'payload' in e;
}

/** 日付整形 */
function formatDateParts(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const date = d.toLocaleDateString('ja-JP');
  const time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  const weekday = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }).format(d);
  return { date, weekday, time };
}

export default function DetailLayerInner() {
  const sp = useSearchParams();
  const logId = sp.get('log');
  const [data, setData] = React.useState<LogDetail | null>(null);
  const residentNameMap = useResidentNameMap();

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!logId) {
        setData(null);
        return;
      }

      const ev = await fetchEventById(logId);
      if (!alive) return;

      // 取得失敗
      if (!ev || !isEventLogStrict(ev)) {
        setData(null);
        return;
      }

      // 会話イベント以外 or payloadが会話型でない
      if (ev.kind !== 'conversation' || !isConversationPayload(ev.payload)) {
        setData(null);
        return;
      }

      const p = ev.payload;
      const { date, weekday, time } = formatDateParts((ev as any).updated_at); // local entity 互換

      const participantNames: [string, string] = [
        residentNameMap[p.participants[0]] ?? p.participants[0],
        residentNameMap[p.participants[1]] ?? p.participants[1],
      ];
      const title = p.topic ?? `${participantNames[0]} と ${participantNames[1]} の会話`;
      const lines: LogDetail['lines'] = p.lines.map((ln) => ({
        speaker: residentNameMap[ln.speaker] ?? ln.speaker,
        text: ln.text,
      }));
      const system: string[] = p.systemLine ? [p.systemLine] : [];

      const next: LogDetail = {
        id: (ev as any).id,
        title,
        date,
        weekday,
        time,
        lines,
        system,
      };
      setData(next);
    })();

    return () => {
      alive = false;
    };
  }, [logId, residentNameMap]);

  return <LogDetailPanel open={!!logId} data={data} />;
}
