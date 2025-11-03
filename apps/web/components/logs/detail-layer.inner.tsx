'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import LogDetailPanel, { LogDetail } from '@/components/logs/log-detail-panel';
import { fetchEventById } from '@/lib/data/notifications';

/** このファイル内だけで使う、会話ペイロードの厳密型（Union回避用） */
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

/** 実行時に payload が会話ペイロードかどうかを判定（最低限） */
function isConversationPayload(p: unknown): p is ConversationPayloadStrict {
  const g = p as ConversationPayloadStrict | undefined;
  return !!g
    && typeof g.threadId === 'string'
    && Array.isArray(g.participants)
    && g.participants.length === 2
    && Array.isArray(g.lines);
}

/** 日付/曜日/時刻の整形（ロケール: ja-JP） */
function formatDateParts(iso: string | undefined) {
  const d = iso ? new Date(iso) : new Date();
  const date = d.toLocaleDateString('ja-JP');
  const time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  const weekday = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }).format(d); // 例: 月/火/水...
  return { date, weekday, time };
}

export default function DetailLayerInner() {
  const sp = useSearchParams();
  const logId = sp.get('log');
  const [data, setData] = React.useState<LogDetail | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (!logId) {
        setData(null);
        return;
      }
      const ev = await fetchEventById(logId);
      if (!alive) return;

      // 不正なID / レコードなし
      if (!ev) {
        setData(null);
        return;
      }

      // 会話イベント以外は表示しない
      if (ev.kind !== 'conversation' || !isConversationPayload(ev.payload)) {
        setData(null);
        return;
      }

      const p = ev.payload; // ConversationPayloadStrict
      const { date, weekday, time } = formatDateParts(ev.updated_at);

      // タイトルは topic があれば優先、なければ participants から簡易生成
      const title =
        p.topic ??
        `${p.participants[0]} と ${p.participants[1]} の会話`;

      const lines: LogDetail['lines'] = (p.lines ?? []).map((ln) => ({
        speaker: ln.speaker,
        text: ln.text,
      }));

      const system: string[] = [];
      if (p.systemLine) system.push(p.systemLine);

      const next: LogDetail = {
        id: ev.id,
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
  }, [logId]);

  return <LogDetailPanel open={!!logId} data={data} />;
}
