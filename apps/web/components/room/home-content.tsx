'use client';

import { Noto_Sans_JP } from 'next/font/google';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchEventById, useMarkNotificationRead, useNotifications } from '@/lib/data/notifications';
import type { NotificationRecord } from '@repo/shared/types/conversation';
import { replaceResidentIds, useResidentNameMap } from '@/lib/data/residents';
import { useWorldWeather } from '@/lib/data/use-world-weather';
import type { WeatherKind } from '@repo/shared/types';
import { GlassPanel } from '@/components/ui-demo/glass-panel';
import { PanelHeader } from '@/components/ui-demo/panel-header';
import { useDeskTransition } from '@/components/room/room-transition-context';

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

type ResidentStatusItem = {
  id: string;
  name: string;
  tone: string;
};

const RESIDENT_STATUS_SAMPLE: ResidentStatusItem[] = [
  { id: 'A', name: 'ハル', tone: 'bg-[#4dbb63] shadow-[0_0_8px_rgba(77,187,99,0.6)]' },
  { id: 'B', name: 'ミオ', tone: 'bg-[#4dbb63] shadow-[0_0_8px_rgba(77,187,99,0.6)]' },
  { id: 'C', name: 'コウ', tone: 'bg-[#4dbb63] shadow-[0_0_8px_rgba(77,187,99,0.6)]' },
  { id: 'D', name: 'レイ', tone: 'bg-[#3a7bd5] shadow-[0_0_8px_rgba(58,123,213,0.6)]' },
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
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
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

  const weatherLabel = weatherState ? WEATHER_LABELS[weatherState.current.kind as WeatherKind] : '---';
  const weatherComment = useMemo(() => {
    if (!weatherState?.currentComment) return '今は静かなようです。';
    const name = weatherState.currentComment.residentId
      ? residentNameMap[weatherState.currentComment.residentId] ?? '住人'
      : null;
    return name ? `${name}「${weatherState.currentComment.text}」` : weatherState.currentComment.text;
  }, [weatherState, residentNameMap]);

  const conversationCards = useMemo(() => {
    const items = conversationNotifications.slice(0, 4);
    const cards: NotificationRecord[][] = [];
    for (let i = 0; i < items.length; i += 2) {
      cards.push(items.slice(i, i + 2));
    }
    return cards;
  }, [conversationNotifications]);

  const consultCards = useMemo(() => consultNotifications.slice(0, 2), [consultNotifications]);

  const openNotification = useCallback(
    async (n: NotificationRecord) => {
      try {
        if (n.status !== 'read') {
          markRead.mutate(n.id);
        }

        const kind = n.type ?? (n as any)?.payload?.kind ?? 'conversation';

        if (kind === 'consult') {
          const consultId =
            (n as any).linkedConsultId ?? (n as any)?.payload?.consultId ?? (n as any)?.consultId;

          if (consultId) {
            const url = new URL(window.location.href);
            url.searchParams.set('consult', String(consultId));
            url.searchParams.delete('log');
            router.push(url.pathname + '?' + url.searchParams.toString(), { scroll: false });
          }
          return;
        }

        const eventId = n.linkedEventId ?? (n as any)?.payload?.eventId ?? (n as any)?.eventId;

        if (eventId) {
          const ev = await fetchEventById(eventId);
          if (!ev) return;

          const url = new URL(window.location.href);
          url.searchParams.set('log', ev.id);
          url.searchParams.delete('consult');
          router.push(url.pathname + '?' + url.searchParams.toString(), { scroll: false });
        }
      } catch (e) {
        // noop
      }
    },
    [markRead, router]
  );

  const navigateDesk = useCallback(
    (href: string) => {
      const delay = deskTransition?.beginDeskTransition() ?? 0;
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

      <main
        className="grid flex-1 items-start gap-[clamp(16px,1.25vw,32px)] max-[1240px]:grid-cols-1"
        style={{
          gridTemplateColumns:
            'minmax(0,clamp(400px,26vw,540px)) minmax(0,clamp(350px,23.5vw,470px)) minmax(0,clamp(400px,23.5vw,500px))',
          width:
            'min(100%, calc(clamp(400px,26vw,540px) + clamp(350px,23.5vw,470px) + clamp(400px,23.5vw,500px) + clamp(16px,1.25vw,32px) * 2))',
          marginInline: 'auto',
        }}
      >
        <GlassPanel className="px-5 py-4" contentClassName="space-y-4">
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
            {conversationCards.map((card, index) => (
              <div
                key={`conversation-card-${index}`}
                className="rounded-[14px] border border-white/50 bg-white/25 px-4 py-3 shadow-[inset_0_0_24px_rgba(255,255,255,0.35)]"
              >
                {card.map((n, rowIndex) => {
                  const title = getNotificationTitle(n, residentNameMap);
                  const initial = getInitialFromTitle(title);
                  const message = n.snippet ? replaceResidentIds(n.snippet, residentNameMap) : title;
                  const time = new Date(n.occurredAt).toLocaleTimeString();
                  return (
                    <div
                      key={n.id}
                      className="grid grid-cols-[26px_1fr_auto] items-center gap-2 py-1 text-base"
                    >
                      <span className="font-semibold text-[#15324b]">{initial}</span>
                      <span>{message}</span>
                      {rowIndex === 0 ? (
                        <span className="font-medium text-black/55">{time}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openNotification(n)}
                          className="text-sm text-black/60 transition hover:translate-x-0.5"
                        >
                          見てみる &gt;
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="px-5 py-4" contentClassName="space-y-4">
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
              const time = new Date(n.occurredAt).toLocaleTimeString();
              return (
                <div
                  key={n.id}
                  className="rounded-[14px] border border-white/50 bg-white/25 px-4 py-3 shadow-[inset_0_0_24px_rgba(255,255,255,0.35)]"
                >
                  <div className="grid grid-cols-[1fr_auto] grid-rows-[auto_auto] gap-x-4 text-base">
                    <div className="row-span-2 flex flex-col pl-[2ch] leading-relaxed">
                      <span className="font-semibold">{name}</span>
                      <span>相談が届いています</span>
                    </div>
                    <span className="justify-self-end text-base font-medium text-black/55">
                      {time}
                    </span>
                    <button
                      type="button"
                      onClick={() => openNotification(n)}
                      className="justify-self-end text-sm text-black/60 transition hover:translate-x-0.5"
                    >
                      回答する &gt;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassPanel>

        <GlassPanel className="px-5 py-4" contentClassName="space-y-4">
          <PanelHeader
            icon="🧑‍🤝‍🧑"
            title="みんなの様子"
            right={
              <div className="flex items-center gap-2">
                <button
                  className="rounded-[10px] border border-black/10 bg-white/55 px-3 py-1 text-[13px] font-medium transition hover:-translate-y-0.5 hover:bg-white/75"
                  type="button"
                >
                  並び替え
                </button>
                <input
                  className="w-20 rounded-[10px] border border-black/10 bg-white/60 px-3 py-1 text-[13px]"
                  placeholder="検索"
                />
              </div>
            }
          />

          <div className="flex flex-col gap-3">
            {RESIDENT_STATUS_SAMPLE.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[20px_1fr_auto] items-center gap-2 rounded-xl border border-white/55 bg-white/25 px-3 py-2"
              >
                <span className={`h-3 w-3 rounded-full ${item.tone}`} />
                <span className="font-medium">{item.name}</span>
                <button
                  className="rounded-[10px] border border-black/10 bg-white/60 px-3 py-1 text-[12px] font-medium transition hover:-translate-y-0.5 hover:bg-white/75"
                  type="button"
                >
                  覗く
                </button>
              </div>
            ))}
          </div>
        </GlassPanel>
      </main>

      <footer className="mt-auto grid grid-cols-[1fr_auto_1fr] items-end gap-4 translate-y-[clamp(-64px,-2.5vw,-32px)] max-[1240px]:grid-cols-1 max-[1240px]:justify-items-center">
        <button
          type="button"
          onClick={() => navigateDesk('/reports')}
          className="uiDemoNavButton uiDemoNavButtonLeft flex w-[6em] items-center justify-center justify-self-start rounded-[10px] border border-[rgba(74,45,18,0.6)] bg-[linear-gradient(180deg,rgba(205,166,120,0.58),rgba(171,120,67,0.6)),repeating-linear-gradient(90deg,rgba(255,255,255,0.04)_0,rgba(255,255,255,0.04)_6px,rgba(255,255,255,0)_6px,rgba(255,255,255,0)_12px)] px-[0.72em] py-2 text-[28px] font-medium text-[#3a240f] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(74,45,18,0.16),0_8px_16px_rgba(40,22,6,0.18)]"
        >
          ← 日報
        </button>

        <GlassPanel className="min-w-[220px] px-9 py-5 text-center text-[#243749]">
          <div className="text-xl tracking-[0.5px]">{now.toLocaleDateString()}</div>
          <div className="text-[32px] font-semibold">{now.toLocaleTimeString()}</div>
        </GlassPanel>

        <button
          type="button"
          onClick={() => navigateDesk('/office')}
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
