'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Cloud, Sun, CloudRain, CloudLightning } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';
import { fetchEventById, useMarkNotificationRead, useNotifications } from '@/lib/data/notifications';
import type { NotificationRecord } from '@repo/shared/types/conversation';
import { replaceResidentIds, useResidentNameMap } from '@/lib/data/residents';
import { useWorldWeather } from '@/lib/data/use-world-weather';
import type { WeatherKind } from '@repo/shared/types';
import { useRelations } from '@/lib/data/relations';
import { RELATION_LABELS } from '@/lib/constants/labels';
import { fontRounded } from '@/styles/fonts';

/* ---------------------------
   共通UI：セクション見出し
---------------------------- */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 mb-2">
      <h2 className="text-xl font-semibold tracking-wide">{children}</h2>
      <div className="h-px w-full bg-border mt-2" />
    </div>
  );
}

type NotificationListItem = NotificationRecord;

function getPlayerDisplayName(email?: string | null) {
  if (!email) return 'プレイヤー';
  const trimmed = email.trim();
  if (!trimmed) return 'プレイヤー';
  return trimmed.split('@')[0] || 'プレイヤー';
}

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

function WeatherIcon({ kind }: { kind: WeatherKind }) {
  const map: Record<WeatherKind, React.ComponentType<{ className?: string }>> = {
    sunny: Sun,
    cloudy: Cloud,
    rain: CloudRain,
    storm: CloudLightning,
  };
  const Icon = map[kind] ?? Cloud;
  return (
    <div className="flex items-center justify-center">
      <Icon className="h-8 w-8 text-[color:var(--ink)]" aria-hidden />
      <span className="sr-only">{kind}</span>
    </div>
  );
}

function BoardCard({
  title,
  meta,
  children,
  className,
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-[22px] border border-[color:var(--paper-border)] bg-[color:var(--paper-bg)] shadow-[var(--shadow-paper)] ${className ?? ''}`}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <span className="inline-flex items-center rounded-full border border-[color:var(--label-border)] bg-[color:var(--label-bg)] px-2.5 py-1 text-[10px] font-semibold tracking-[0.25em] text-[color:var(--ink)]">
          {title}
        </span>
        {meta ? <div className="text-[11px] text-[color:var(--ink-muted)]">{meta}</div> : null}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </div>
  );
}

function NotificationList({
  items,
  isLoading,
  emptyText,
  onOpen,
  residentNameMap,
}: {
  items: NotificationListItem[];
  isLoading: boolean;
  emptyText: string;
  onOpen: (item: NotificationListItem) => void;
  residentNameMap: Record<string, string>;
}) {
  return (
    <ul className="divide-y divide-[color:var(--paper-border)]">
      {isLoading && (
        <li className="py-2 text-sm text-[color:var(--ink-muted)]">読み込み中…</li>
      )}
      {!isLoading && items.length === 0 && (
        <li className="py-2 text-sm text-[color:var(--ink-muted)]">{emptyText}</li>
      )}
      {items.map((n) => {
        const title = getNotificationTitle(n, residentNameMap);
        const snippet =
          n.snippet ? replaceResidentIds(n.snippet, residentNameMap) : null;
        const time = new Date(n.occurredAt).toLocaleString();
        return (
          <li key={n.id} className="py-2">
            <button
              onClick={() => onOpen(n)}
              className="w-full flex items-start gap-3 text-left"
              aria-label={snippet ?? title}
            >
              <span
                className={`mt-1 h-2 w-2 rounded-full ${n.status === 'unread' ? 'bg-[color:var(--ink)]' : 'bg-[color:var(--ink-soft)]'
                  }`}
              />
              <span className="flex-1 min-w-0">
                <div className="text-sm">{title}</div>
                {snippet && (
                  <div className="text-xs text-[color:var(--ink-muted)] line-clamp-1">
                    {snippet}
                  </div>
                )}
              </span>
              <span className="text-[11px] text-[color:var(--ink-muted)] whitespace-nowrap">
                {time}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ----------------------------
   ページ本体
----------------------------- */
export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const residentNameMap = useResidentNameMap();
  const { data: weatherState } = useWorldWeather();
  const { data: notifications = [], isLoading: isLoadingNotifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const { data: relations = [], isLoading: isLoadingRelations } = useRelations();

  const playerName = useMemo(() => getPlayerDisplayName(user?.email), [user?.email]);

  const recentNotifications = useMemo(
    () => filterRecentNotifications(notifications),
    [notifications],
  );

  const conversationNotifications = useMemo(
    () => recentNotifications.filter((n) => n.type === 'conversation'),
    [recentNotifications],
  );

  const consultNotifications = useMemo(
    () => recentNotifications.filter((n) => n.type === 'consult'),
    [recentNotifications],
  );

  const unreadConversation = conversationNotifications.filter((n) => n.status === 'unread').length;
  const unreadConsult = consultNotifications.filter((n) => n.status === 'unread').length;

  const featuredRelations = useMemo(() => {
    return relations
      .filter((r) => r.type && r.type !== 'none')
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
      .slice(0, 3);
  }, [relations]);

  const openNotification = useCallback(async (n: NotificationRecord) => {
    try {
      if (n.status !== 'read') {
        markRead.mutate(n.id);
      }

      const kind = n.type ?? (n as any)?.payload?.kind ?? 'conversation';

      if (kind === 'consult') {
        const consultId =
          (n as any).linkedConsultId ??
          (n as any)?.payload?.consultId ??
          (n as any)?.consultId;

        if (consultId) {
          const url = new URL(window.location.href);
          url.searchParams.set('consult', String(consultId));
          url.searchParams.delete('log');
          router.push(url.pathname + '?' + url.searchParams.toString(), { scroll: false });
        }
        return;
      }

      const eventId =
        n.linkedEventId ??
        (n as any)?.payload?.eventId ??
        (n as any)?.eventId;

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
  }, [markRead, router]);


  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--ink)] bg-[radial-gradient(1200px_600px_at_50%_10%,rgba(255,255,255,0.6),transparent_70%)]">
      <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-6 p-4 sm:p-6">
        <Card className="relative flex flex-1 flex-col rounded-[34px] border-2 border-[color:var(--board-border)] bg-[color:var(--board-bg)] shadow-[var(--board-shadow)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[34px] before:bg-[radial-gradient(120%_120%_at_50%_-10%,rgba(255,255,255,0.55),transparent_60%)] before:opacity-70 after:pointer-events-none after:absolute after:inset-0 after:rounded-[34px] after:bg-[radial-gradient(rgba(30,35,43,0.08)_1px,transparent_1px)] after:bg-[length:6px_6px] after:opacity-25">
          <CardContent className={`relative z-10 flex flex-1 flex-col px-5 py-6 ${fontRounded.className}`}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[11px] font-semibold tracking-[0.4em] text-[color:var(--ink-muted)]">
                掲示板
              </div>
            </div>
            <div className="grid flex-1 gap-4 lg:grid-cols-2">
              <BoardCard
                title="会話"
                meta={`未読 ${unreadConversation} 件`}
                className="lg:min-h-[320px]"
              >
                <NotificationList
                  items={conversationNotifications.slice(0, 4)}
                  isLoading={isLoadingNotifications}
                  emptyText="誰も話していないようです。"
                  onOpen={openNotification}
                  residentNameMap={residentNameMap}
                />
              </BoardCard>

              <BoardCard
                title="受信箱"
                meta={`未読 ${unreadConsult} 件`}
                className="lg:min-h-[320px]"
              >
                <NotificationList
                  items={consultNotifications.slice(0, 4)}
                  isLoading={isLoadingNotifications}
                  emptyText="相談は届いていません。"
                  onOpen={openNotification}
                  residentNameMap={residentNameMap}
                />
              </BoardCard>

              <BoardCard title="新聞">
                {weatherState ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-[color:var(--ink-muted)]">現在の天気</div>
                      <WeatherIcon kind={weatherState.current.kind as WeatherKind} />
                    </div>
                    <div className="text-xs text-[color:var(--ink-muted)]">
                      最終更新: {new Date(weatherState.current.lastChangedAt).toLocaleString()}
                    </div>
                    <div className="h-px bg-[color:var(--paper-border)]" />
                    <div className="text-sm">
                      {weatherState.currentComment ? (
                        <span>
                          {weatherState.currentComment.residentId
                            ? `${residentNameMap[weatherState.currentComment.residentId] ?? '住人'}「${weatherState.currentComment.text}」`
                            : weatherState.currentComment.text}
                        </span>
                      ) : (
                        <span className="text-[color:var(--ink-muted)]">コメントはまだありません。</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-[color:var(--ink-muted)]">天気情報を読み込み中…</div>
                )}
              </BoardCard>

              <BoardCard title="注目の関係">
                {isLoadingRelations ? (
                  <div className="text-sm text-[color:var(--ink-muted)]">関係を読み込み中…</div>
                ) : featuredRelations.length === 0 ? (
                  <div className="text-sm text-[color:var(--ink-muted)]">注目の関係は特にありません。</div>
                ) : (
                  <div className="space-y-3">
                    {featuredRelations.map((rel) => {
                      const nameA = residentNameMap[rel.a_id] ?? '住人A';
                      const nameB = residentNameMap[rel.b_id] ?? '住人B';
                      const relationLabel = RELATION_LABELS[rel.type] ?? 'なし';
                      return (
                        <div key={rel.id} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{nameA} × {nameB}</div>
                            <div className="text-xs text-[color:var(--ink-muted)]">{relationLabel}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full border-[color:var(--paper-border)] bg-[color:var(--label-bg)] text-[11px] text-[color:var(--ink)] hover:bg-[color:var(--paper-bg)]"
                            asChild
                          >
                            <Link href={`/office/relations/${rel.id}`}>覗く</Link>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </BoardCard>
            </div>
          </CardContent>
        </Card>

        <div className="grid items-stretch gap-4 lg:grid-cols-[1.1fr_1fr] lg:h-[132px]">
          <Button
            asChild
            variant="outline"
            className="relative h-24 overflow-hidden rounded-[28px] border-2 border-[color:var(--plaque-border)] bg-[color:var(--plaque-bg)] text-lg text-[color:var(--ink)] shadow-[var(--plaque-shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] active:translate-y-0 active:shadow-[var(--plaque-shadow-pressed)] lg:h-full"
          >
            <Link href="/reports">日報</Link>
          </Button>

          <div className="flex h-full flex-col gap-3">
            <Button
              asChild
              variant="outline"
              className="relative h-16 w-full justify-between overflow-hidden rounded-[22px] border-2 border-[color:var(--plaque-border)] bg-[color:var(--plaque-bg)] text-base text-[color:var(--ink)] shadow-[var(--plaque-shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] active:translate-y-0 active:shadow-[var(--plaque-shadow-pressed)]"
            >
              <Link href="/home/residents">
                みんなの様子
                <span className="text-sm">→</span>
              </Link>
            </Button>

            <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr] lg:h-14">
              <Button
                asChild
                variant="outline"
                className="relative h-14 overflow-hidden rounded-[20px] border-2 border-[color:var(--plaque-border)] bg-[color:var(--plaque-bg)] text-base text-[color:var(--ink)] shadow-[var(--plaque-shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] active:translate-y-0 active:shadow-[var(--plaque-shadow-pressed)]"
              >
                <Link href="/office">管理室</Link>
              </Button>

              <Link
                href="/player"
                className="relative flex h-14 items-center justify-center overflow-hidden rounded-[20px] border-2 border-[color:var(--plaque-border)] bg-[color:var(--plaque-bg)] text-sm font-semibold text-[color:var(--ink)] shadow-[var(--plaque-shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] active:translate-y-0 active:shadow-[var(--plaque-shadow-pressed)]"
              >
                {playerName}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
