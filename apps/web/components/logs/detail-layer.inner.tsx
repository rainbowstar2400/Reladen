'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import LogDetailPanel, { LogDetail } from '@/components/logs/log-detail-panel';
import { fetchEventById } from '@/lib/data/notifications';
import type { EventLogStrict } from '@repo/shared/types/conversation';
import { replaceResidentIds, useResidentNameMap } from '@/lib/data/residents';

function translateImpressionLabel(label: string) {
  const dictionary: Record<string, string> = {
    dislike: '苦手',
    maybe_dislike: '嫌いかも',
    awkward: '気まずい',
    none: 'なし',
    curious: '気になる',
    maybe_like: '好きかも',
    like: '好き',
  };

  return dictionary[label] ?? label;
}

function parseSystemLine(rawLine: string, nameMap: Record<string, string>): string[] {
  if (!rawLine) return [];

  const replaced = replaceResidentIds(rawLine, nameMap);
  if (!replaced.startsWith('SYSTEM: ')) return [replaced];

  const body = replaced.replace(/^SYSTEM:\s*/, '');
  const segments = body.split(' / ').map((segment) => segment.trim()).filter(Boolean);

  const messages: string[] = [];

  segments.forEach((segment) => {
    if (segment.includes('Belief更新')) return;

    const favorMatch = segment.match(/^(.*?)→(.*?)\s*好感度:\s*(↑|↓)/);
    if (favorMatch) {
      const [, from, to, direction] = favorMatch;
      const change = direction === '↑' ? '上昇しました。' : '下降しました。';
      messages.push(`${from}から${to}への好感度が${change}`);
      return;
    }

    const impressionMatch = segment.match(/^(.*?)→(.*?)\s*印象:\s*([^→]+)→(.+)$/);
    if (impressionMatch) {
      const [, from, to, next] = impressionMatch;
      const translated = translateImpressionLabel(next.trim());
      messages.push(`${from}から${to}への印象が「${translated}」に変化しました。`);
      return;
    }

    messages.push(segment);
  });

  return messages;
}

/** 会話ペイロード（Union回避用の厳密な型） */
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
    aToB: { favor: number; impression: any; impressionState?: { base: string; special: string | null } };
    bToA: { favor: number; impression: any; impressionState?: { base: string; special: string | null } };
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

      // systemLine があれば優先。無ければ payload の impressionState を fallback に使う
      const system = p.systemLine ? parseSystemLine(p.systemLine, residentNameMap) : [];

      const fallbackMessages: string[] = [];
      const deltas = (p as any)?.deltas ?? {};
      const pickImpression = (entry: any) => {
        const st = entry?.impressionState;
        if (st?.special === 'awkward') return 'awkward';
        if (st?.base) return String(st.base);
        if (entry?.impression != null) return String(entry.impression);
        return null;
      };
      const impAB = pickImpression(deltas.aToB ?? {});
      const impBA = pickImpression(deltas.bToA ?? {});
      if (impAB) fallbackMessages.push(`${participantNames[0]}から${participantNames[1]}への印象: ${translateImpressionLabel(impAB)}`);
      if (impBA) fallbackMessages.push(`${participantNames[1]}から${participantNames[0]}への印象: ${translateImpressionLabel(impBA)}`);

      const systemMessages = system.length ? system : fallbackMessages;

      const next: LogDetail = {
        id: (ev as any).id,
        title,
        date,
        weekday,
        time,
        lines,
        system: systemMessages,
      };
      setData(next);
    })();

    return () => {
      alive = false;
    };
  }, [logId, residentNameMap]);

  return <LogDetailPanel open={!!logId} data={data} />;
}
