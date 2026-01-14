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
      <Icon className="h-8 w-8 text-foreground" aria-hidden />
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
    <Card className={`rounded-2xl border-secondary/30 bg-card/90 shadow-sm ${className ?? ''}`}>
      <div className="flex items-center justify-between border-b border-secondary/30 px-4 py-3">
        <div className="font-semibold">{title}</div>
        {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
      </div>
      <div className="px-4 py-3">{children}</div>
    </Card>
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
    <ul className="divide-y">
      {isLoading && (
        <li className="py-2 text-sm text-muted-foreground">読み込み中…</li>
      )}
      {!isLoading && items.length === 0 && (
        <li className="py-2 text-sm text-muted-foreground">{emptyText}</li>
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
                className={`mt-1 h-2 w-2 rounded-full ${n.status === 'unread' ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
              />
              <span className="flex-1 min-w-0">
                <div className="text-sm">{title}</div>
                {snippet && (
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {snippet}
                  </div>
                )}
              </span>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
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
    <div className="p-4 bg-gradient-to-b from-secondary/20 via-background to-background">
      <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-6">
        <Card className="flex flex-1 flex-col rounded-3xl border border-secondary/30 bg-secondary/20 shadow-sm">
          <CardContent className={`flex flex-1 flex-col px-5 py-6 ${fontRounded.className}`}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-muted-foreground">掲示板</div>
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
                      <div className="text-sm text-muted-foreground">現在の天気</div>
                      <WeatherIcon kind={weatherState.current.kind as WeatherKind} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      最終更新: {new Date(weatherState.current.lastChangedAt).toLocaleString()}
                    </div>
                    <div className="h-px bg-border" />
                    <div className="text-sm">
                      {weatherState.currentComment ? (
                        <span>
                          {weatherState.currentComment.residentId
                            ? `${residentNameMap[weatherState.currentComment.residentId] ?? '住人'}「${weatherState.currentComment.text}」`
                            : weatherState.currentComment.text}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">コメントはまだありません。</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">天気情報を読み込み中…</div>
                )}
              </BoardCard>

              <BoardCard title="注目の関係">
                {isLoadingRelations ? (
                  <div className="text-sm text-muted-foreground">関係を読み込み中…</div>
                ) : featuredRelations.length === 0 ? (
                  <div className="text-sm text-muted-foreground">注目の関係は特にありません。</div>
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
                            <div className="text-xs text-muted-foreground">{relationLabel}</div>
                          </div>
                          <Button size="sm" variant="ghost" asChild>
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
            className="h-24 rounded-3xl bg-white text-lg text-foreground hover:bg-muted lg:h-full"
          >
            <Link href="/reports">日報</Link>
          </Button>

          <div className="flex h-full flex-col gap-3">
            <Button
              asChild
              variant="outline"
              className="h-16 w-full justify-between rounded-2xl bg-white text-base text-foreground hover:bg-muted"
            >
              <Link href="/home/residents">
                みんなの様子
                <span className="text-sm">→</span>
              </Link>
            </Button>

            <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr] lg:h-14">
              <Button asChild variant="outline" className="h-14 rounded-2xl text-base">
                <Link href="/office">管理室</Link>
              </Button>

              <Link
                href="/player"
                className="flex h-14 items-center justify-center rounded-2xl border bg-background text-sm font-semibold hover:bg-muted"
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
