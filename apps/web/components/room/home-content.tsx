'use client';

import { Noto_Sans_JP } from 'next/font/google';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { fetchEventById, useMarkNotificationRead, useNotifications } from '@/lib/data/notifications';
import type { NotificationRecord } from '@repo/shared/types/conversation';
import type { EventLogStrict } from '@repo/shared/types/conversation';
import { replaceResidentIds, useResidentNameMap, useResidents } from '@/lib/data/residents';
import { useWorldWeather } from '@/lib/data/use-world-weather';
import type { WeatherKind } from '@repo/shared/types';
import { listLocal } from '@/lib/db-local';
import { useFeelings } from '@/lib/data/feelings';
import { GlassPanel } from '@/components/ui-demo/glass-panel';
import { PanelHeader } from '@/components/ui-demo/panel-header';
import { useDeskTransition } from '@/components/room/room-transition-context';
import { LogDetailPanelContent, type LogDetail } from '@/components/logs/log-detail-panel';
import { ConsultDetailPanelContent, type ConsultDetail } from '@/components/consults/consult-detail-panel';
import { loadConsultAnswer, saveConsultAnswer } from '@/lib/client/consult-storage';
import { useSync } from '@/lib/sync/use-sync';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calcSituation, type Situation, type SleepProfile } from '../../../../packages/shared/logic/schedule';
import { useQueryClient } from '@tanstack/react-query';

const notoSans = Noto_Sans_JP({
  weight: ['300', '400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
});

const WEATHER_LABELS: Record<WeatherKind, string> = {
  sunny: '晴れ',
  cloudy: 'くもり',
  rain: '雨',
  storm: '雷雨',
};

const SITUATION_TONE_MAP: Record<Situation, string> = {
  active: 'bg-[#4dbb63] shadow-[0_0_8px_rgba(77,187,99,0.6)]',
  preparing: 'bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.6)]',
  sleeping: 'bg-[#3a7bd5] shadow-[0_0_8px_rgba(58,123,213,0.6)]',
};

type ResidentStatusItem = {
  id: string;
  name: string;
  tone: string;
  trustToPlayer?: number;
};

type HomePanelMode = 'none' | 'right-detail' | 'right-peek' | 'popup-consult';

const RESIDENT_STATUS_SAMPLE: ResidentStatusItem[] = [
  { id: 'A', name: 'ハル', tone: 'bg-[#4dbb63] shadow-[0_0_8px_rgba(77,187,99,0.6)]', trustToPlayer: 50 },
  { id: 'B', name: 'ミオ', tone: 'bg-[#4dbb63] shadow-[0_0_8px_rgba(77,187,99,0.6)]', trustToPlayer: 45 },
  { id: 'C', name: 'コウ', tone: 'bg-[#4dbb63] shadow-[0_0_8px_rgba(77,187,99,0.6)]', trustToPlayer: 60 },
  { id: 'D', name: 'レイ', tone: 'bg-[#3a7bd5] shadow-[0_0_8px_rgba(58,123,213,0.6)]', trustToPlayer: 55 },
];

function filterRecentNotifications(notifications: NotificationRecord[]) {
  const now = Date.now();

  return notifications.filter((n) => {
    const occurredAt = new Date(n.occurredAt).getTime();
    const diffHours = (now - occurredAt) / (1000 * 60 * 60);

    if (n.status === 'read') {
      return diffHours < 5;
    }

    if (n.status === 'unread') {
      return diffHours < 10;
    }

    return true;
  });
}

function getNotificationTitle(n: NotificationRecord, residentNameMap: Record<string, string>) {
  const participantIds = Array.isArray(n.participants) ? n.participants : [];
  const participantNames = participantIds.map((id) => residentNameMap[id] ?? id);

  if (n.type === 'conversation') {
    if (participantNames.length === 2) {
      return `${participantNames[0]}と${participantNames[1]}が話しています…`;
    }
    return '会話が発生しました';
  }

  if (n.type === 'consult') {
    if (participantNames.length >= 1) {
      return `${participantNames[0]}から相談が届きました`;
    }
    return '相談が届きました';
  }

  return 'お知らせ';
}

function getInitialFromTitle(title: string) {
  if (!title) return '・';
  return title.trim().slice(0, 1);
}

export function HomeContent() {
  const router = useRouter();
  const deskTransition = useDeskTransition();
  const residentNameMap = useResidentNameMap();
  const { data: weatherState } = useWorldWeather();
  const { data: notifications = [], isLoading: isLoadingNotifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const { sync } = useSync();
  const queryClient = useQueryClient();
  const { data: residents = [] } = useResidents();
  const { data: feelings = [] } = useFeelings();
  const [now, setNow] = useState<Date | null>(null);
  const [panelMode, setPanelMode] = useState<HomePanelMode>('none');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConsultId, setActiveConsultId] = useState<string | null>(null);
  const [activePeekResidentId, setActivePeekResidentId] = useState<string | null>(null);
  const [logDetail, setLogDetail] = useState<LogDetail | null>(null);
  const [consultDetail, setConsultDetail] = useState<ConsultDetail | null>(null);
  const [peekInteraction, setPeekInteraction] = useState<{ partnerName: string; kind: string } | null>(
    null
  );
  const [peekResult, setPeekResult] = useState<{
    residentId: string;
    situation: string;
    monologue: string;
    fetchedAt: number;
  } | null>(null);
  const [peekLoading, setPeekLoading] = useState(false);
  const [sortKey, setSortKey] = useState<'name' | 'trust'>('name');
  const [searchTerm, setSearchTerm] = useState('');
  const [conversationLineMap, setConversationLineMap] = useState<
    Record<string, { speaker: string; text: string }[]>
  >({});

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const recentNotifications = useMemo(
    () => filterRecentNotifications(notifications),
    [notifications]
  );

  const conversationNotifications = useMemo(
    () => recentNotifications.filter((n) => n.type === 'conversation'),
    [recentNotifications]
  );

  const consultNotifications = useMemo(
    () => recentNotifications.filter((n) => n.type === 'consult'),
    [recentNotifications]
  );

  const unreadConversation = conversationNotifications.filter((n) => n.status === 'unread').length;
  const unreadConsult = consultNotifications.filter((n) => n.status === 'unread').length;

  const nowMinute = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const residentStatusList = useMemo<ResidentStatusItem[]>(() => {
    if (residents.length === 0) return RESIDENT_STATUS_SAMPLE;
    return residents.map((r) => {
      const situation = now
        ? calcSituation(now, (r.sleepProfile ?? {}) as SleepProfile)
        : 'preparing';
      return {
        // 状態 (active / preparing / sleeping) に応じてインジケータ色を切り替える
        tone: SITUATION_TONE_MAP[situation],
        id: r.id,
        name: r.name ?? '住人',
        trustToPlayer: r.trustToPlayer ?? 0,
      };
    });
  }, [residents, nowMinute]);
  const filteredResidentStatusList = useMemo(() => {
    const term = searchTerm.trim();
    let list = residentStatusList;
    if (term) {
      list = list.filter((item) => item.name.includes(term));
    }
    if (sortKey === 'trust') {
      list = [...list].sort(
        (a, b) => (b.trustToPlayer ?? 0) - (a.trustToPlayer ?? 0)
      );
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ja-JP'));
    }
    return list;
  }, [residentStatusList, searchTerm, sortKey]);

  const weatherLabel = weatherState ? WEATHER_LABELS[weatherState.current.kind as WeatherKind] : '---';
  const weatherComment = useMemo(() => {
    if (!weatherState?.currentComment) return '今は静かなようです。';
    const name = weatherState.currentComment.residentId
      ? residentNameMap[weatherState.currentComment.residentId] ?? '住人'
      : null;
    return name ? `${name}「${weatherState.currentComment.text}」` : weatherState.currentComment.text;
  }, [weatherState, residentNameMap]);

  const conversationCards = useMemo(
    () => conversationNotifications.slice(0, 4),
    [conversationNotifications]
  );

  const consultCards = useMemo(() => consultNotifications.slice(0, 2), [consultNotifications]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const items = conversationNotifications.slice(0, 4);
      const results = await Promise.all(
        items.map(async (n) => {
          const eventId = n.linkedEventId ?? (n as any)?.payload?.eventId ?? (n as any)?.eventId;
          if (!eventId) return [null, null] as const;
          const ev = await fetchEventById(eventId);
          if (!ev || !isEventLogStrict(ev) || ev.kind !== 'conversation' || !isConversationPayload(ev.payload)) {
            return [eventId, null] as const;
          }
          const lines = ev.payload.lines
            .map((ln) => ({
              speaker: replaceResidentIds(ln.speaker, residentNameMap),
              text: replaceResidentIds(ln.text, residentNameMap),
            }))
            .slice(0, 2);
          return [eventId, lines] as const;
        })
      );
      if (!alive) return;
      const next: Record<string, { speaker: string; text: string }[]> = {};
      results.forEach(([id, lines]) => {
        if (id && lines) next[id] = lines;
      });
      setConversationLineMap(next);
    })();
    return () => {
      alive = false;
    };
  }, [conversationNotifications, residentNameMap]);

  const slideAmount = 'clamp(480px, 30vw, 640px)';
  const panelVars = {
    '--panel-left': 'clamp(400px,26vw,540px)',
    '--panel-center': 'clamp(350px,23.5vw,470px)',
    '--panel-right': 'clamp(400px,23.5vw,500px)',
    '--panel-gap': 'clamp(16px,1.25vw,32px)',
    '--panel-slide': slideAmount,
  } as React.CSSProperties;
  const panelGridStyle = {
    ...panelVars,
    gridTemplateColumns:
      'minmax(0,var(--panel-left)) minmax(0,var(--panel-center)) minmax(0,var(--panel-right))',
    columnGap: 'var(--panel-gap)',
    width:
      'min(100%, calc(var(--panel-left) + var(--panel-center) + var(--panel-right) + (var(--panel-gap) * 2)))',
    marginInline: 'auto',
  } as React.CSSProperties;
  const isRightDetail = panelMode === 'right-detail';
  const isRightPeek = panelMode === 'right-peek';
  const isPopupConsult = panelMode === 'popup-consult';
  const showFloatingLayer = isRightDetail || isRightPeek;
  const floatingPanelStyle = isRightDetail
    ? {
        left: 'calc(var(--panel-left) + var(--panel-gap))',
        width: 'calc(var(--panel-slide) - var(--panel-gap))',
      }
    : isRightPeek
      ? { right: 0, width: 'var(--panel-slide)' }
      : undefined;

  const openConversation = useCallback(
    async (n: NotificationRecord) => {
      try {
        if (n.status !== 'read') {
          markRead.mutate(n.id);
        }
        const eventId = n.linkedEventId ?? (n as any)?.payload?.eventId ?? (n as any)?.eventId;
        if (!eventId) return;
        const ev = await fetchEventById(eventId);
        if (!ev) return;
        setActiveConversationId(ev.id);
        setActiveConsultId(null);
        setConsultDetail(null);
        setPanelMode('right-detail');
      } catch (e) {
        // noop
      }
    },
    [markRead]
  );

  const openConsult = useCallback(
    (n: NotificationRecord) => {
      try {
        const consultId =
          (n as any).linkedConsultId ?? (n as any)?.payload?.consultId ?? (n as any)?.consultId;
        if (!consultId) return;
        setActiveConsultId(String(consultId));
        setActiveConversationId(null);
        setLogDetail(null);
        setPanelMode('popup-consult');
      } catch (e) {
        // noop
      }
    },
    []
  );

  const closePanel = useCallback(() => {
    setPanelMode('none');
    setActiveConversationId(null);
    setActiveConsultId(null);
    setActivePeekResidentId(null);
    setLogDetail(null);
    setConsultDetail(null);
  }, []);

  function formatDateParts(iso?: string) {
    const d = iso ? new Date(iso) : new Date();
    const date = d.toLocaleDateString('ja-JP');
    const time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const weekday = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }).format(d);
    return { date, weekday, time };
  }

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
    const serverAnswer = apiData?.answer ?? null;
    const updatedISO: string | undefined =
      src?.updated_at || p?.updated_at || p?.occurredAt || undefined;
    const d = updatedISO ? new Date(updatedISO) : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    const participantFallback =
      Array.isArray(p?.participants) && p.participants.length > 0 ? p.participants[0] : undefined;
    const prompt = {
      speaker: p?.speaker ?? p?.residentName ?? p?.from ?? participantFallback ?? 'Someone',
      text: p?.text ?? p?.content ?? p?.body ?? '',
    };
    const choicesRaw: any[] =
      Array.isArray(p?.choices) ? p.choices : Array.isArray(p?.options) ? p.options : [];
    const choices: ConsultDetail['choices'] = choicesRaw.map((c, idx) => ({
      id: String(c?.id ?? c?.value ?? `c${idx + 1}`),
      label: String(c?.label ?? c?.text ?? c ?? `選択肢 ${idx + 1}`),
    }));
    const replyEntries = p?.replyByChoice ?? p?.replies ?? {};
    const replyByChoice: ConsultDetail['replyByChoice'] = Object.fromEntries(
      Object.entries(replyEntries).map(([k, v]) => [String(k), String(v as any)])
    );
    const systemAfter: string[] = Array.isArray(p?.systemAfter)
      ? p.systemAfter.map(String)
      : [];
    return {
      id: src?.id ?? id,
      title: p?.title ?? p?.subject ?? `${prompt.speaker}からの相談`,
      date: `${yyyy}/${mm}/${dd}`,
      weekday,
      time: `${hh}:${mi}`,
      prompt,
      choices,
      replyByChoice,
      systemAfter,
      selectedChoiceId: serverAnswer?.selectedChoiceId ?? null,
    };
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!activeConversationId) {
        if (alive) setLogDetail(null);
        return;
      }
      const ev = await fetchEventById(activeConversationId);
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
      const title = p.topic ?? `${participantNames[0]} と ${participantNames[1]} が話している。`;
      const lines: LogDetail['lines'] = p.lines.map((ln) => ({
        speaker: residentNameMap[ln.speaker] ?? replaceResidentIds(ln.speaker, residentNameMap),
        text: replaceResidentIds(ln.text, residentNameMap),
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
      if (impAB) fallbackMessages.push(`${participantNames[0]} から ${participantNames[1]} への印象が ${translateImpressionLabel(impAB)}に変化した。`);
      if (impBA) fallbackMessages.push(`${participantNames[1]} から ${participantNames[0]} への印象が ${translateImpressionLabel(impBA)}に変化した。`);
      const systemMessages = (system.length ? system : fallbackMessages).map((line) =>
        replaceResidentIds(line, residentNameMap)
      );
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
  }, [activeConversationId, residentNameMap]);

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
        const mappedSpeaker = residentNameMap[base.prompt.speaker] ?? base.prompt.speaker;
        const stored = await loadConsultAnswer(base.id);
        if (!alive) return;
        setConsultDetail({
          ...base,
          prompt: { ...base.prompt, speaker: mappedSpeaker },
          selectedChoiceId: base.selectedChoiceId ?? stored?.selectedChoiceId ?? null,
        });
      } catch {
        try {
          const localEvents = (await listLocal('events')) as EventLogStrict[];
          const ev = localEvents.find((item) => item.id === activeConsultId);
          if (!ev || ev.kind !== 'consult') throw new Error('no local consult');
          const base = normalizeToConsultDetail(ev, activeConsultId);
          const mappedSpeaker = residentNameMap[base.prompt.speaker] ?? base.prompt.speaker;
          if (!alive) return;
          setConsultDetail({
            ...base,
            prompt: { ...base.prompt, speaker: mappedSpeaker },
            selectedChoiceId: null,
          });
        } catch {
          if (alive) setConsultDetail(null);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeConsultId, residentNameMap]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!activePeekResidentId) {
        if (alive) setPeekInteraction(null);
        return;
      }
      try {
        const events = (await listLocal<EventLogStrict>('events'))
          .filter((item) => item && (item.kind === 'conversation' || item.kind === 'consult'))
          .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
        const found = events.find((ev) => {
          const p = (ev as any)?.payload;
          const participants = Array.isArray(p?.participants) ? p.participants : [];
          return participants.includes(activePeekResidentId);
        });
        if (!found) {
          if (alive) setPeekInteraction(null);
          return;
        }
        const p = (found as any)?.payload;
        const participants = Array.isArray(p?.participants) ? p.participants : [];
        const otherId = participants.find((id: string) => id !== activePeekResidentId);
        const partnerName = otherId ? residentNameMap[otherId] ?? otherId : '—';
        const kindLabel = found.kind === 'conversation' ? '会話' : '相談';
        if (alive) setPeekInteraction({ partnerName, kind: kindLabel });
      } catch {
        if (alive) setPeekInteraction(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activePeekResidentId, residentNameMap]);

  const peekResident = useMemo(
    () => residents.find((r) => r.id === activePeekResidentId),
    [residents, activePeekResidentId]
  );
  const peekTopFavor = useMemo(() => {
    if (!activePeekResidentId) return null;
    const byFrom = feelings
      .filter((f) => f.from_id === activePeekResidentId && !f.deleted)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const top = byFrom[0];
    if (!top) return null;
    const name = residentNameMap[top.to_id] ?? top.to_id;
    return { name, score: top.score ?? 0 };
  }, [feelings, activePeekResidentId, residentNameMap]);

  // --- 覗く API 呼び出し（30分キャッシュ） ---
  useEffect(() => {
    if (!activePeekResidentId || panelMode !== 'right-peek') return;

    // キャッシュチェック: 同じ住人で30分以内ならスキップ
    const CACHE_TTL_MS = 30 * 60 * 1000;
    if (
      peekResult &&
      peekResult.residentId === activePeekResidentId &&
      Date.now() - peekResult.fetchedAt < CACHE_TTL_MS
    ) {
      return;
    }

    let alive = true;
    setPeekLoading(true);

    const timeOfDay = (() => {
      const hour = now ? now.getHours() : new Date().getHours();
      if (hour < 6) return '深夜';
      if (hour < 10) return '朝';
      if (hour < 14) return '昼';
      if (hour < 18) return '夕方';
      return '夜';
    })();

    fetch('/api/peeks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        residentId: activePeekResidentId,
        timeOfDay,
        weather: weatherState?.current?.kind,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setPeekResult({
          residentId: activePeekResidentId,
          situation: data.situation,
          monologue: data.monologue,
          fetchedAt: Date.now(),
        });
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setPeekLoading(false);
      });

    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeekResidentId, panelMode]);

  const handleConsultDecide = useCallback(
    async (choiceId: string) => {
      if (!activeConsultId) return;
      const result = await saveConsultAnswer(activeConsultId, choiceId);
      const selected = result.selectedChoiceId ?? choiceId;
      setConsultDetail((prev) => (prev ? { ...prev, selectedChoiceId: selected } : prev));
      if (result.applied) {
        await queryClient.invalidateQueries({ queryKey: ['residents'] });
      }
      try {
        await sync();
      } catch {
        // noop
      }
      const notif = consultNotifications.find(
        (n) =>
          (n as any).linkedConsultId === activeConsultId ||
          (n as any).linkedEventId === activeConsultId
      );
      if (notif && notif.status !== 'read') {
        markRead.mutate(notif.id);
      }
    },
    [activeConsultId, consultNotifications, markRead, queryClient, sync]
  );

  const navigateDesk = useCallback(
    (href: string, target: 'home' | 'desk') => {
      const delay = deskTransition?.beginDeskTransition(target) ?? 0;
      window.setTimeout(() => {
        router.push(href);
      }, delay);
    },
    [deskTransition, router]
  );

  return (
    <div
      className={`relative z-10 flex min-h-screen flex-col gap-[clamp(24px,2.5vw,56px)] px-[clamp(32px,7.5vw,144px)] py-[clamp(16px,1.25vw,32px)] pb-[clamp(18px,1.5vw,36px)] ${notoSans.className}`}
    >
      <header className="flex justify-center">
        <GlassPanel
          className="w-[clamp(600px,52vw,1000px)] px-7 py-3"
          contentClassName="flex items-center gap-4"
        >
          <div className="flex items-center gap-4">
            <span className="text-lg font-medium">天気：{weatherLabel}</span>
            <span className="text-lg">{weatherComment}</span>
          </div>
        </GlassPanel>
      </header>

      <main className="relative flex-1">
        <div
          className="relative grid items-start gap-[clamp(16px,1.25vw,32px)] max-[1240px]:grid-cols-1"
          style={panelGridStyle}
        >
          <motion.div
            className="relative"
            style={{ gridColumn: '1 / span 1' }}
            animate={{ x: isRightPeek ? `calc(-1 * ${slideAmount})` : 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          >
            <GlassPanel
              className="desk-panel-scroll max-h-[55vh] overflow-y-auto px-5 py-4"
              contentClassName="space-y-4"
            >
          <PanelHeader
            icon="🗨️"
            title="会話"
            right={<span className="text-sm text-black/60">未読 {unreadConversation} 件</span>}
          />

          {isLoadingNotifications && (
            <div className="rounded-[14px] border border-white/50 bg-white/25 px-4 py-3 text-base text-black/55 shadow-[inset_0_0_24px_rgba(255,255,255,0.35)]">
              読み込み中…
            </div>
          )}

          {!isLoadingNotifications && conversationCards.length === 0 && (
            <div className="rounded-[14px] border border-white/50 bg-white/25 px-4 py-3 text-base text-black/55 shadow-[inset_0_0_24px_rgba(255,255,255,0.35)]">
              誰も話していないようです。
            </div>
          )}

          <div className="space-y-4">
            {conversationCards.map((n) => (
              <div
                key={`conversation-card-${n.id}`}
                className="rounded-[14px] border border-white/50 bg-white/25 px-4 py-3 shadow-[inset_0_0_24px_rgba(255,255,255,0.35)]"
                style={
                  activeConversationId && (() => {
                    const linkedEventId =
                      n.linkedEventId ?? (n as any)?.payload?.eventId ?? (n as any)?.eventId;
                    return linkedEventId === activeConversationId;
                  })()
                    ? {
                        backgroundColor: 'rgba(255,255,255,0.5)',
                        boxShadow:
                          'inset 0 0 24px rgba(255,255,255,0.55), 0 0 0 2px rgba(255,255,255,0.95), 0 12px 24px rgba(6,18,32,0.2)',
                        border: '2px solid rgba(255,255,255,0.95)',
                      }
                    : undefined
                }
              >
                {(() => {
                  const title = getNotificationTitle(n, residentNameMap);
                  const time = new Date(n.occurredAt).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const linkedEventId =
                    n.linkedEventId ?? (n as any)?.payload?.eventId ?? (n as any)?.eventId;
                  const lines = (linkedEventId && conversationLineMap[linkedEventId])
                    ? conversationLineMap[linkedEventId]
                    : [{
                        speaker: '',
                        text: n.snippet ? replaceResidentIds(n.snippet, residentNameMap) : title,
                      }];
                  return (
                    <>
                      <div className="grid grid-cols-[4em_1fr_auto] items-center gap-[10px] px-1 py-[6px] text-[16px] leading-[1.1]">
                        <span className="overflow-hidden whitespace-nowrap font-semibold text-[#15324b]">
                          {lines[0]?.speaker ?? ''}
                        </span>
                        <span>{lines[0]?.text ?? title}</span>
                        <span className="text-[16px] font-medium text-black/55">{time}</span>
                      </div>
                      <div className="grid grid-cols-[4em_1fr_auto] items-center gap-[10px] px-1 py-[6px] text-[16px] leading-[1.1]">
                        <span className="overflow-hidden whitespace-nowrap font-semibold text-[#15324b]">
                          {lines[1]?.speaker ?? ''}
                        </span>
                        <span>{lines[1]?.text ?? ''}</span>
                        <button
                          type="button"
                          onClick={() => openConversation(n)}
                          className={
                            'text-[14px] text-black/60 transition hover:translate-x-0.5 ' +
                            (n.status === 'unread' ? 'underline underline-offset-4' : '')
                          }
                        >
                          見てみる &gt;
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
            </GlassPanel>
          </motion.div>

          <motion.div
            className="relative grid"
            style={{
              gridColumn: '2 / span 2',
              gridTemplateColumns:
                'minmax(0,var(--panel-center)) minmax(0,var(--panel-right))',
              columnGap: 'var(--panel-gap)',
            }}
            animate={{
              x: isRightDetail
                ? slideAmount
                : isRightPeek
                  ? `calc(-1 * ${slideAmount})`
                  : 0,
            }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          >
            <GlassPanel
              className="desk-panel-scroll max-h-[55vh] overflow-y-auto px-5 py-4"
              contentClassName="space-y-4"
            >
          <PanelHeader
            icon="✉"
            title="相談"
            right={<span className="text-sm text-black/60">未読 {unreadConsult} 件</span>}
          />

          {isLoadingNotifications && (
            <div className="rounded-[14px] border border-white/50 bg-white/25 px-4 py-3 text-base text-black/55 shadow-[inset_0_0_24px_rgba(255,255,255,0.35)]">
              読み込み中…
            </div>
          )}

          {!isLoadingNotifications && consultCards.length === 0 && (
            <div className="rounded-[14px] border border-white/50 bg-white/25 px-4 py-3 text-base text-black/55 shadow-[inset_0_0_24px_rgba(255,255,255,0.35)]">
              相談が届いていません。
            </div>
          )}

          <div className="space-y-4">
            {consultCards.map((n) => {
              const title = getNotificationTitle(n, residentNameMap);
              const name = title.replace('から相談が届きました', '');
              const time = new Date(n.occurredAt).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={n.id}
                  className="rounded-[14px] border border-white/50 bg-white/25 px-4 py-3 shadow-[inset_0_0_24px_rgba(255,255,255,0.35)]"
                >
                  <div className="grid grid-cols-[1fr_auto] grid-rows-[auto_auto] items-center gap-x-4 gap-y-0.5 py-[6px] text-[16px]">
                    <div className="row-span-2 flex flex-col pl-[2ch] leading-[1.5]">
                      <span className="font-semibold">{name} から</span>
                      <span>相談が届いています</span>
                    </div>
                    <span className="justify-self-end text-[16px] font-medium text-black/55">
                      {time}
                    </span>
                    <button
                      type="button"
                      onClick={() => openConsult(n)}
                      className={
                        'justify-self-end text-[14px] text-black/60 transition hover:translate-x-0.5 ' +
                        (n.status === 'unread' ? 'underline underline-offset-4' : '')
                      }
                    >
                      回答する &gt;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
            </GlassPanel>

            <GlassPanel
              className="desk-panel-scroll max-h-[55vh] overflow-y-auto px-5 py-4"
              contentClassName="space-y-4"
            >
          <PanelHeader
            icon="🧑‍🤝‍🧑"
            title="みんなの様子"
            right={
              <div className="flex items-center gap-2">
                <Select value={sortKey} onValueChange={(value) => setSortKey(value as 'name' | 'trust')}>
                  <SelectTrigger className="h-8 w-[100px] rounded-[10px] border border-black/10 bg-white/55 px-3 text-[13px] font-medium text-slate-600">
                    <SelectValue placeholder="並び替え" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">名前順</SelectItem>
                    <SelectItem value="trust">信頼度順</SelectItem>
                  </SelectContent>
                </Select>
                <input
                  className="w-24 rounded-[10px] border border-black/10 bg-white/60 px-3 py-1 text-[13px]"
                  placeholder="検索"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            }
          />

          <div className="flex flex-col gap-3">
            {filteredResidentStatusList.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[20px_1fr_auto] items-center gap-2 rounded-xl border border-white/55 bg-white/25 px-3 py-2"
              >
                <span className={`h-3 w-3 rounded-full ${item.tone}`} />
                <span className="font-medium">{item.name}</span>
                <button
                  className="rounded-[10px] border border-black/10 bg-white/60 px-3 py-1 text-[12px] font-medium transition hover:-translate-y-0.5 hover:bg-white/75"
                  type="button"
                  onClick={() => {
                    setActivePeekResidentId(item.id);
                    setActiveConversationId(null);
                    setActiveConsultId(null);
                    setLogDetail(null);
                    setConsultDetail(null);
                    setPanelMode('right-peek');
                  }}
                >
                  覗く
                </button>
              </div>
            ))}
          </div>
            </GlassPanel>
          </motion.div>

          {showFloatingLayer && (
            <div className="pointer-events-none absolute inset-0">
              <div className="relative h-full" style={panelGridStyle}>
                <div className="absolute inset-y-0" style={floatingPanelStyle} />
              </div>
            </div>
          )}

          <AnimatePresence>
            {isRightDetail && logDetail && (
              <>
                <motion.div
                  className="absolute inset-0 z-30 rounded-[24px] bg-white/10 backdrop-blur-[6px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, x: slideAmount }}
                  exit={{ opacity: 0 }}
                  onClick={closePanel}
                />
                <motion.aside
                  initial={{ x: 80, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 80, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                  className="absolute z-40 rounded-2xl border border-white/60 bg-white/20 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-8px_20px_rgba(4,18,30,0.14),0_8px_16px_rgba(4,18,30,0.18),0_26px_42px_rgba(4,18,30,0.22)] backdrop-blur-[18px] saturate-125"
                  style={{
                    ...floatingPanelStyle,
                    borderColor: 'rgba(255,255,255,0.7)',
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(115deg,rgba(255,255,255,0.6),rgba(255,255,255,0.22)_32%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.18))] opacity-55"
                    aria-hidden="true"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(rgba(255,255,255,0.2)_0.6px,transparent_0.6px)] bg-[length:6px_6px] opacity-20 mix-blend-soft-light"
                    aria-hidden="true"
                  />
                  <div className="relative z-10 desk-panel-scroll max-h-[55vh] overflow-y-auto">
                    <LogDetailPanelContent data={logDetail} onClose={closePanel} />
                  </div>
                </motion.aside>
              </>
            )}

            {isPopupConsult && consultDetail && (
              <>
                <motion.div
                  className="absolute inset-0 z-30 rounded-[24px] bg-white/10 backdrop-blur-[6px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={closePanel}
                />
                <motion.div
                  className="absolute inset-0 z-40 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.aside
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 24, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                    className="w-[min(520px,86vw)] rounded-2xl border border-white/60 bg-white/20 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-8px_20px_rgba(4,18,30,0.14),0_8px_16px_rgba(4,18,30,0.18),0_26px_42px_rgba(4,18,30,0.22)] backdrop-blur-[18px] saturate-125"
                    style={{ borderColor: 'rgba(255,255,255,0.7)', marginTop: '15vh' }}
                  >
                    <div
                      className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(115deg,rgba(255,255,255,0.6),rgba(255,255,255,0.22)_32%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.18))] opacity-55"
                      aria-hidden="true"
                    />
                    <div
                      className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(rgba(255,255,255,0.2)_0.6px,transparent_0.6px)] bg-[length:6px_6px] opacity-20 mix-blend-soft-light"
                      aria-hidden="true"
                    />
                    <div className="relative z-10">
                    <ConsultDetailPanelContent
                      data={consultDetail}
                      onDecide={handleConsultDecide}
                      onClose={closePanel}
                    />
                    </div>
                  </motion.aside>
                </motion.div>
              </>
            )}
            {isRightPeek && (
              <>
                <motion.div
                  className="absolute inset-0 z-30 rounded-[24px] bg-white/10 backdrop-blur-[6px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, x: `calc(-1 * ${slideAmount})` }}
                  exit={{ opacity: 0 }}
                  onClick={closePanel}
                />
                <motion.aside
                  initial={{ x: 80, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 80, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                  className="absolute z-40 rounded-2xl border border-white/60 bg-white/20 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-8px_20px_rgba(4,18,30,0.14),0_8px_16px_rgba(4,18,30,0.18),0_26px_42px_rgba(4,18,30,0.22)] backdrop-blur-[18px] saturate-125"
                  style={{
                    right: 0,
                    width: 'calc(var(--panel-slide) - var(--panel-gap))',
                    borderColor: 'rgba(255,255,255,0.7)',
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(115deg,rgba(255,255,255,0.6),rgba(255,255,255,0.22)_32%,rgba(255,255,255,0.05)_60%,rgba(255,255,255,0.18))] opacity-55"
                    aria-hidden="true"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(rgba(255,255,255,0.2)_0.6px,transparent_0.6px)] bg-[length:6px_6px] opacity-20 mix-blend-soft-light"
                    aria-hidden="true"
                  />
                  <div className="relative z-10 desk-panel-scroll max-h-[55vh] overflow-y-auto">
                  <div className="flex items-start justify-between border-b p-4">
                    <div className="text-lg font-medium">
                      {peekResident?.name ?? '住人'}の様子
                    </div>
                    <button
                      onClick={closePanel}
                      className="rounded-md p-1 hover:bg-muted"
                      aria-label="閉じる"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-3 p-4 text-base text-slate-700">
                    <div className="flex gap-4 text-sm text-slate-500">
                      <span>信頼度：{peekResident?.trustToPlayer ?? '—'}</span>
                      <span>仲良し：{peekTopFavor ? peekTopFavor.name : '—'}</span>
                    </div>
                    {peekInteraction && (
                      <div className="text-sm text-slate-500">
                        最近：{peekInteraction.partnerName}と{peekInteraction.kind}した
                      </div>
                    )}
                    {peekLoading ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
                        様子を見ています…
                      </div>
                    ) : peekResult && peekResult.residentId === activePeekResidentId ? (
                      <>
                        <div className="leading-relaxed">{peekResult.situation}</div>
                        <div className="mt-2 rounded-lg border border-white/50 bg-white/30 px-3 py-2 text-sm italic">
                          「{peekResult.monologue}」
                        </div>
                      </>
                    ) : (
                      <div className="py-4 text-sm text-slate-400">読み込み中…</div>
                    )}
                  </div>
                  </div>
                </motion.aside>
              </>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="mt-auto grid grid-cols-[1fr_auto_1fr] items-end gap-4 translate-y-[clamp(-64px,-2.5vw,-32px)] max-[1240px]:grid-cols-1 max-[1240px]:justify-items-center">
        <button
          type="button"
          onClick={() => navigateDesk('/reports', 'desk')}
          className="uiDemoNavButton uiDemoNavButtonLeft flex w-[6em] items-center justify-center justify-self-start rounded-[10px] border border-[rgba(74,45,18,0.6)] bg-[linear-gradient(180deg,rgba(205,166,120,0.58),rgba(171,120,67,0.6)),repeating-linear-gradient(90deg,rgba(255,255,255,0.04)_0,rgba(255,255,255,0.04)_6px,rgba(255,255,255,0)_6px,rgba(255,255,255,0)_12px)] px-[0.72em] py-2 text-[28px] font-medium text-[#3a240f] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(74,45,18,0.16),0_8px_16px_rgba(40,22,6,0.18)]"
        >
          ← 日報
        </button>

        <GlassPanel className="min-w-[220px] px-9 py-5 text-center text-[#243749]">
          <div className="text-xl tracking-[0.5px]">
            {now ? now.toLocaleDateString() : '----/--/--'}
          </div>
          <div className="text-[32px] font-semibold">
            {now ? now.toLocaleTimeString() : '--:--:--'}
          </div>
        </GlassPanel>

        <button
          type="button"
          onClick={() => navigateDesk('/office', 'desk')}
          className="uiDemoNavButton uiDemoNavButtonRight flex w-[6em] items-center justify-center justify-self-end rounded-[10px] border border-[rgba(74,45,18,0.6)] bg-[linear-gradient(180deg,rgba(205,166,120,0.58),rgba(171,120,67,0.6)),repeating-linear-gradient(90deg,rgba(255,255,255,0.04)_0,rgba(255,255,255,0.04)_6px,rgba(255,255,255,0)_6px,rgba(255,255,255,0)_12px)] px-[0.72em] py-2 text-[28px] font-medium text-[#3a240f] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(74,45,18,0.16),0_8px_16px_rgba(40,22,6,0.18)]"
        >
          管理室 →
        </button>
      </footer>

      <style jsx>{`
        :global(.uiDemoNavButton) {
          transition: transform 140ms ease, box-shadow 140ms ease;
        }
        :global(.uiDemoNavButtonLeft) {
          transform: translateX(80%) rotate(-20deg);
          --nav-shift: 80%;
          --nav-rotate: -20deg;
        }
        :global(.uiDemoNavButtonRight) {
          transform: translateX(-80%) rotate(20deg);
          --nav-shift: -80%;
          --nav-rotate: 20deg;
        }
        @media (hover: hover) and (pointer: fine) {
          :global(.uiDemoNavButton:hover) {
            transform: translateX(var(--nav-shift, 0)) rotate(var(--nav-rotate, 0))
              translateY(-2px);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3),
              inset 0 -2px 4px rgba(74, 45, 18, 0.2), 0 12px 18px rgba(40, 22, 6, 0.22);
          }
        }
        :global(.uiDemoNavButton:focus-visible) {
          outline: 2px solid rgba(15, 90, 130, 0.45);
          outline-offset: 2px;
        }
        :global(.uiDemoNavButton:active) {
          transform: translateY(1px);
        }
      `}</style>
    </div>
  );
}
