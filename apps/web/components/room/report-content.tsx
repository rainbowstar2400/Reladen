'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { bulkUpsert, listLocal } from '@/lib/db-local';
import type { EventLogStrict } from '@repo/shared/types/conversation';
import { replaceResidentIds, useResidentNameMap } from '@/lib/data/residents';
import { detectImpressionLabelChanges } from '@/lib/repos/conversation-repo';
import { remoteFetchRecentEvents } from '@/lib/sync/remote-events';
import { fetchEventById } from '@/lib/data/notifications';
import { useDeskTransition } from '@/components/room/room-transition-context';
import { LogDetailPanelContent, LogDetail } from '@/components/logs/log-detail-panel';
import { ConsultDetailPanelContent, ConsultDetail } from '@/components/consults/consult-detail-panel';
import { motion, AnimatePresence } from 'framer-motion';
import { loadConsultAnswer, saveConsultAnswer } from '@/lib/client/consult-storage';
import { useSync } from '@/lib/sync/use-sync';

type ChangeKind = '好感度' | '印象' | '関係' | '信頼度';
type ChangeKindFilter = ChangeKind | '';
type ReportItem = {
  id: string;
  at: string;
  text: string;
  category: 'conversation' | 'consult' | 'other';
  chips: { kind: ChangeKind; label: string }[];
  a?: string;
  b?: string;
};

const KINDS: ChangeKind[] = ['好感度', '印象', '関係', '信頼度'];

const CHIP_CLASS: Record<ChangeKind, string> = {
  '好感度':
    'bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/60 dark:hover:text-rose-200',
  '印象':
    'bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/60 dark:hover:text-sky-200',
  '関係':
    'bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/60 dark:hover:text-amber-200',
  '信頼度':
    'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-200',
};

type ReportPanelMode = 'none' | 'log' | 'consult';

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

function formatDateParts(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const date = d.toLocaleDateString('ja-JP');
  const time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  const weekday = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }).format(d);
  return { date, weekday, time };
}

function isEventLogStrict(x: unknown): x is EventLogStrict {
  const e = x as EventLogStrict | undefined;
  return !!e && typeof e === 'object' && 'kind' in e && 'payload' in e;
}

function isConversationPayload(p: any): p is {
  threadId: string;
  participants: [string, string];
  lines: { speaker: string; text: string }[];
  deltas?: any;
  systemLine?: string;
  topic?: string;
} {
  return !!p
    && typeof p.threadId === 'string'
    && Array.isArray(p.participants)
    && p.participants.length === 2
    && Array.isArray(p.lines);
}

function normalizeToConsultDetail(apiData: any, id: string): ConsultDetail {
  const src = apiData?.consult ?? apiData ?? {};
  const p = src?.payload ?? src?.data ?? src ?? {};

  const updatedISO: string | undefined =
    src?.updated_at || p?.updated_at || p?.occurredAt || undefined;
  const d = updatedISO ? new Date(updatedISO) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];

  const prompt = {
    speaker: p?.speaker ?? p?.residentName ?? p?.from ?? 'Someone',
    text: p?.text ?? p?.content ?? p?.body ?? '',
  };

  const choicesRaw: any[] =
    Array.isArray(p?.choices) ? p.choices : Array.isArray(p?.options) ? p.options : [];
  const choices: ConsultDetail['choices'] = choicesRaw.map((c, idx) => ({
    id: String(c?.id ?? c?.value ?? `c${idx + 1}`),
    label: String(c?.label ?? c?.text ?? c ?? `選択肢 ${idx + 1}`),
  }));

  const replyEntries =
    p?.replyByChoice ??
    p?.replies ??
    {};
  const replyByChoice: ConsultDetail['replyByChoice'] = Object.fromEntries(
    Object.entries(replyEntries).map(([k, v]) => [String(k), String(v as any)])
  );

  const systemAfter: string[] = Array.isArray(p?.systemAfter)
    ? p.systemAfter.map(String)
    : [];

  return {
    id: src?.id ?? id,
    title: p?.title ?? p?.subject ?? '相談',
    date: `${yyyy}/${mm}/${dd}`,
    weekday,
    time: `${hh}:${mi}`,
    prompt,
    choices,
    replyByChoice,
    systemAfter,
    selectedChoiceId: null,
  };
}

function fmtDate(d: Date) {
  const f = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const p = f.formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { y: get('year'), m: get('month'), d: get('day'), wd: get('weekday') };
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return f.format(d);
}

export function ReportContent() {
  const router = useRouter();
  const deskTransition = useDeskTransition();
  const residentNameMap = useResidentNameMap();
  const { sync } = useSync();

  const [panelMode, setPanelMode] = useState<ReportPanelMode>('none');
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [activeConsultId, setActiveConsultId] = useState<string | null>(null);
  const [logDetail, setLogDetail] = useState<LogDetail | null>(null);
  const [consultDetail, setConsultDetail] = useState<ConsultDetail | null>(null);

  const openLog = useCallback((id: string) => {
    setActiveConsultId(null);
    setConsultDetail(null);
    setPanelMode('log');
    setActiveLogId(id);
  }, []);

  const openConsult = useCallback((id: string) => {
    setActiveLogId(null);
    setLogDetail(null);
    setPanelMode('consult');
    setActiveConsultId(id);
  }, []);

  const closePanel = useCallback(() => {
    setPanelMode('none');
    setActiveLogId(null);
    setActiveConsultId(null);
    setLogDetail(null);
    setConsultDetail(null);
  }, []);

  const navigateDesk = (href: string, target: 'home' | 'desk') => {
    const delay = deskTransition?.beginDeskTransition(target) ?? 0;
    window.setTimeout(() => {
      router.push(href);
    }, delay);
  };

  const [date, setDate] = useState('');
  const [charA, setCharA] = useState<string>('');
  const [charB, setCharB] = useState<string>('');
  const [kind, setKind] = useState<ChangeKindFilter>('');
  const resetFilters = () => {
    setDate('');
    setCharA('');
    setCharB('');
    setKind('');
  };

  const [convItems, setConvItems] = useState<ReportItem[]>([]);

  const buildReportItems = useCallback(
    (events: EventLogStrict[]): ReportItem[] => {
      const targets = events.filter(
        (ev) => ev && (ev.kind === 'conversation' || ev.kind === 'consult')
      );
      const impressionChangeMap = detectImpressionLabelChanges(targets as EventLogStrict[]);

      return targets.map((ev) => {
        const occurred =
          (ev as any)?.payload?.occurredAt ??
          (ev as any)?.occurredAt ??
          ev.updated_at ??
          (ev as any)?.created_at ??
          new Date().toISOString();

        const participants = Array.isArray((ev as any)?.payload?.participants)
          ? (ev as any).payload.participants
          : [];

        const a = participants[0] ?? undefined;
        const b = participants[1] ?? undefined;

        const displayA = a ? (residentNameMap[a] ?? a) : '';
        const displayB = b ? (residentNameMap[b] ?? b) : '';

        const chips: ReportItem['chips'] = [];
        const deltas = (ev as any)?.payload?.deltas ?? (ev as any)?.deltas;
        const change = impressionChangeMap.get(ev.id);
        const toLabel = (s: string) => {
          switch (s) {
            case 'none':
              return 'なし';
            case 'like':
              return '好き';
            case 'like?':
              return '好きかも';
            case 'curious':
              return '気になる';
            case 'awkward':
              return '気まずい';
            case 'dislike':
              return '嫌い';
            case 'dislike?':
              return '嫌いかも';
            default:
              return s;
          }
        };
        const pickImpression = (entry: any) => {
          const st = entry?.impressionState;
          if (st?.special === 'awkward') return 'awkward';
          if (st?.base) return String(st.base);
          if (entry?.impression != null) return String(entry.impression);
          return null;
        };
        if (deltas) {
          const aToB = deltas.aToB ?? {};
          const bToA = deltas.bToA ?? {};
          const favorAB = Number(aToB.favor ?? 0);
          const favorBA = Number(bToA.favor ?? 0);
          if (a && b) {
            if (favorAB > 0) chips.push({ kind: '好感度', label: ` ${displayA}→${displayB}：↑` });
            if (favorAB < 0) chips.push({ kind: '好感度', label: ` ${displayA}→${displayB}：↓` });
            if (favorBA > 0) chips.push({ kind: '好感度', label: ` ${displayB}→${displayA}：↑` });
            if (favorBA < 0) chips.push({ kind: '好感度', label: ` ${displayB}→${displayA}：↓` });
          }
          if (a && b) {
            const impAB = change?.aToB === false ? null : pickImpression(aToB);
            const impBA = change?.bToA === false ? null : pickImpression(bToA);
            if (impAB != null)
              chips.push({ kind: '印象', label: ` ${displayA}→${displayB}：${toLabel(impAB)}` });
            if (impBA != null)
              chips.push({ kind: '印象', label: ` ${displayB}→${displayA}：${toLabel(impBA)}` });
          }
        }

        const systemLine =
          typeof (ev as any)?.payload?.systemLine === 'string'
            ? replaceResidentIds((ev as any).payload.systemLine, residentNameMap)
            : undefined;

        const participantsText =
          systemLine && displayA && displayB ? `${displayA} と ${displayB} が話している。` : undefined;

        const text =
          participantsText ??
          systemLine ??
          (ev as any)?.payload?.title ??
          (ev.kind === 'consult'
            ? `${displayA ?? ''} から相談を受けた。`.trim()
            : displayA && displayB
              ? `${displayA} と ${displayB} が会話した。`
              : '出来事が記録されました。');

        const category: ReportItem['category'] =
          ev.kind === 'consult' ? 'consult' : ev.kind === 'conversation' ? 'conversation' : 'other';

        return {
          id: ev.id,
          at: occurred,
          text,
          category,
          chips,
          a,
          b,
        };
      });
    },
    [residentNameMap]
  );

  useEffect(() => {
    let alive = true;

    const loadLocal = async () => {
      const all = (await listLocal('events')) as unknown as EventLogStrict[];
      if (alive) setConvItems(buildReportItems(all));
    };

    const fetchRemoteAndMerge = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        const remote = await remoteFetchRecentEvents(200);
        if (!remote.length) return;
        await bulkUpsert('events', remote as any);
        if (!alive) return;
        const merged = (await listLocal('events')) as unknown as EventLogStrict[];
        if (alive) setConvItems(buildReportItems(merged));
      } catch (e) {
        console.warn('reports: remote fetch skipped', e);
      }
    };

    (async () => {
      try {
        await loadLocal();
      } catch (e) {
        console.error('reports: load events failed', e);
        if (alive) setConvItems([]);
      }
      await fetchRemoteAndMerge();
    })();
    return () => {
      alive = false;
    };
  }, [buildReportItems]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!activeLogId) {
        if (alive) setLogDetail(null);
        return;
      }
      const ev = await fetchEventById(activeLogId);
      if (!alive) return;
      if (!ev || !isEventLogStrict(ev) || ev.kind !== 'conversation' || !isConversationPayload(ev.payload)) {
        setLogDetail(null);
        return;
      }
      const p = ev.payload;
      const { date, weekday, time } = formatDateParts((ev as any).updated_at);
      const participantNames: [string, string] = [
        residentNameMap[p.participants[0]] ?? p.participants[0],
        residentNameMap[p.participants[1]] ?? p.participants[1],
      ];
      const title = p.topic ?? `${participantNames[0]} と ${participantNames[1]} の会話`;
      const lines: LogDetail['lines'] = p.lines.map((ln) => ({
        speaker: residentNameMap[ln.speaker] ?? ln.speaker,
        text: ln.text,
      }));
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

      setLogDetail({
        id: (ev as any).id,
        title,
        date,
        weekday,
        time,
        lines,
        system: systemMessages,
      });
    })();
    return () => {
      alive = false;
    };
  }, [activeLogId, residentNameMap]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!activeConsultId) {
        if (alive) setConsultDetail(null);
        return;
      }
      try {
        const res = await fetch(`/api/consults/${activeConsultId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`failed to load consult (${res.status})`);
        const json = await res.json();
        if (!alive) return;
        const base = normalizeToConsultDetail(json, activeConsultId);
        const stored = await loadConsultAnswer(base.id);
        if (!alive) return;
        setConsultDetail({
          ...base,
          selectedChoiceId: stored?.selectedChoiceId ?? null,
        });
      } catch {
        if (alive) setConsultDetail(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeConsultId]);
  const ALL: ReportItem[] = useMemo(() => convItems, [convItems]);

  const filtered = useMemo(() => {
    const items = ALL
      .filter((it) => (!date || it.at.startsWith(date)))
      .filter((it) => (charA ? it.a === charA || it.b === charA : true))
      .filter((it) => (charB ? it.a === charB || it.b === charB : true))
      .filter((it) => (kind === '' ? true : it.chips?.some((chip) => chip.kind === kind)))
      .sort((a, b) => (a.at < b.at ? 1 : -1));
    return items;
  }, [ALL, date, charA, charB, kind]);

  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 250);
    return () => clearTimeout(t);
  }, [date, charA, charB, kind]);

  const pageSize = 10;
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [date, charA, charB, kind]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  const allCharacters = useMemo(() => {
    const s = new Set<string>();
    convItems.forEach((it) => {
      if (it.a) s.add(it.a);
      if (it.b) s.add(it.b);
    });
    return Array.from(s).sort();
  }, [convItems]);

  const handleConsultDecide = useCallback(
    async (choiceId: string) => {
      if (!activeConsultId) return;
      await saveConsultAnswer(activeConsultId, choiceId);
      setConsultDetail((prev) => (prev ? { ...prev, selectedChoiceId: choiceId } : prev));
      try {
        await sync();
      } catch {
        // noop
      }
    },
    [activeConsultId, sync]
  );

  return (
    <div className="relative -mx-6 -my-9 space-y-6 overflow-hidden rounded-[28px] px-6 py-9">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="outline"
          className="h-10 rounded-xl text-sm"
          onClick={() => navigateDesk('/home', 'home')}
        >
          ホームに戻る
        </Button>
        <Button
          variant="outline"
          className="h-10 rounded-xl text-sm"
          onClick={() => navigateDesk('/office', 'desk')}
        >
          管理室へ
        </Button>
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">日付：</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border bg-background px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">キャラクター：</span>
            <select
              value={charA}
              onChange={(e) => setCharA(e.target.value)}
              className="rounded-md border bg-background px-2 py-1 text-sm"
            >
              <option value="">—</option>
              {allCharacters.map((c) => (
                <option key={c} value={c}>
                  {residentNameMap[c] ?? c}
                </option>
              ))}
            </select>
            <select
              value={charB}
              onChange={(e) => setCharB(e.target.value)}
              className="rounded-md border bg-background px-2 py-1 text-sm"
            >
              <option value="">—</option>
              {allCharacters.map((c) => (
                <option key={c} value={c}>
                  {residentNameMap[c] ?? c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">変化種別：</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ChangeKindFilter)}
              className="rounded-md border bg-background px-2 py-1 text-sm"
            >
              <option value="">—</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex items-center">
            <Button variant="outline" size="sm" onClick={resetFilters}>
              リセット
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="relative">
        <div className="space-y-6">
          <div className="space-y-4">
            {pageItems.length === 0 && !loading && (
              <p className="py-16 text-center text-sm text-muted-foreground">
                この条件に一致する記録はありません。
              </p>
            )}

            {pageItems.map((it, index) => {
              const { y, m, d, wd } = fmtDate(new Date(it.at));
              const prev = index > 0 ? pageItems[index - 1] : null;
              const prevDate = prev ? fmtDate(new Date(prev.at)) : null;
              const showHeading =
                index === 0 || !prevDate || prevDate.y !== y || prevDate.m !== m || prevDate.d !== d;

              return (
                <React.Fragment key={it.id}>
                  {showHeading && (
                    <div className="mt-6 first:mt-0">
                      <h2 className="text-2xl font-semibold">
                        {y}/{m}/{d} <span className="text-lg text-muted-foreground">{wd}</span>
                      </h2>
                      <div className="mt-2 h-px w-full bg-border" />
                    </div>
                  )}

                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      if (it.category === 'consult') {
                        openConsult(it.id);
                      } else if (it.category === 'conversation') {
                        openLog(it.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between rounded-2xl border px-4 py-3 hover:bg-muted/50">
                      <div className="space-y-2">
                        <p>{it.text}</p>
                        <div className="min-h-6 flex flex-wrap gap-2">
                          {it.chips?.map((c, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className={
                                CHIP_CLASS[c.kind] +
                                ' text-[11px] font-medium transition-colors ' +
                                (kind && c.kind === kind ? 'ring-1 ring-current' : '')
                              }
                            >
                              {c.kind}
                              {c.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="ml-4 shrink-0 tabular-nums text-sm text-muted-foreground">
                        {fmtTime(it.at)}
                      </div>
                    </div>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2 pt-4">
            {page > 1 && (
              <Button variant="outline" size="icon" onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button
                key={i}
                variant={page === i + 1 ? 'secondary' : 'outline'}
                size="icon"
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </Button>
            ))}
            {page < totalPages && (
              <Button variant="outline" size="icon" onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-background/60 backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">読み込み中…</p>
          </div>
        )}

      </div>

      <AnimatePresence>
        {panelMode !== 'none' && (
          <>
            <motion.div
              className="absolute z-20 rounded-[26px] bg-white/15 backdrop-blur-[6px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePanel}
              style={{ top: '-64px', right: '-40px', bottom: '-64px', left: '-40px' }}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: '-16px' }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
              className="absolute inset-y-0 right-0 z-30 w-full max-w-[560px] rounded-[24px] border border-white/60 bg-white/25 shadow-[0_18px_40px_rgba(6,18,32,0.18)] backdrop-blur-md"
            >
              {panelMode === 'log' && logDetail && (
                <LogDetailPanelContent data={logDetail} onClose={closePanel} />
              )}
              {panelMode === 'consult' && consultDetail && (
                <ConsultDetailPanelContent
                  data={consultDetail}
                  onDecide={handleConsultDecide}
                  onClose={closePanel}
                />
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
