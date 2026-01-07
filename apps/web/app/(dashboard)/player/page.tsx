'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/use-auth';
import { useResidents } from '@/lib/data/residents';
import { useEvents } from '@/lib/data/events';
import { replaceResidentIds, useResidentNameMap } from '@/lib/data/residents';
import type { EventLog } from '@/types';
import { Loader2 } from 'lucide-react';

function getPlayerDisplayName(email?: string | null) {
  if (!email) return 'プレイヤー';
  const trimmed = email.trim();
  if (!trimmed) return 'プレイヤー';
  return trimmed.split('@')[0] || 'プレイヤー';
}

function formatEventSummary(event: EventLog, residentNameMap: Record<string, string>) {
  const payload = (event as any)?.payload ?? {};
  if (event.kind === 'conversation') {
    if (payload.systemLine) {
      return replaceResidentIds(String(payload.systemLine), residentNameMap);
    }
    if (Array.isArray(payload.participants) && payload.participants.length >= 2) {
      const [a, b] = payload.participants;
      const nameA = residentNameMap[a] ?? a;
      const nameB = residentNameMap[b] ?? b;
      return `${nameA} と ${nameB} の会話が記録されました。`;
    }
    return '会話が記録されました。';
  }

  if (event.kind === 'consult') {
    return '相談が記録されました。';
  }

  if (payload.title) {
    return String(payload.title);
  }

  return '出来事が記録されました。';
}

export default function PlayerPage() {
  const { user } = useAuth();
  const { data: residents = [], isLoading: isLoadingResidents } = useResidents();
  const { data: eventsData, isLoading: isLoadingEvents } = useEvents();
  const residentNameMap = useResidentNameMap();

  const playerName = useMemo(() => getPlayerDisplayName(user?.email), [user?.email]);

  const recentEvents = useMemo(() => {
    const items = eventsData?.pages.flatMap((page) => page.items) ?? [];
    return items.slice(0, 6);
  }, [eventsData]);

  const trustRows = useMemo(() => {
    return [...residents].sort((a, b) => (b.trustToPlayer ?? 0) - (a.trustToPlayer ?? 0));
  }, [residents]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">プレイヤーデータ</h1>
          <p className="text-sm text-muted-foreground">{playerName}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/home">ホームへ戻る</Link>
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">これまでの観察記録</h2>
        {isLoadingEvents ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            読み込み中…
          </div>
        ) : recentEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ記録はありません。</p>
        ) : (
          <div className="space-y-3">
            {recentEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border px-4 py-3">
                <div className="text-xs text-muted-foreground">
                  {new Date(event.updated_at).toLocaleString()}
                </div>
                <div className="text-sm">
                  {formatEventSummary(event, residentNameMap)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">信頼度レベル</h2>
        {isLoadingResidents ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            読み込み中…
          </div>
        ) : trustRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">住人がいません。</p>
        ) : (
          <div className="space-y-3">
            {trustRows.map((resident) => {
              const trust = Math.max(0, Math.min(100, resident.trustToPlayer ?? 0));
              return (
                <div key={resident.id} className="rounded-2xl border px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{resident.name ?? '（名前未設定）'}</div>
                    <div className="text-sm tabular-nums text-muted-foreground">{trust}</div>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${trust}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
