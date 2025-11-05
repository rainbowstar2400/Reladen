'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MessageSquare, Cloud, AlertTriangle, Moon } from 'lucide-react';
import React, { useMemo } from 'react';
import NotificationsSectionClient from '@/components/notifications/NotificationsSection.client';
import { Suspense } from 'react';
import { calcSituation, defaultSleepByTendency } from '@/lib/schedule';
// （将来の実データ切替用）Resident 型があれば有効化
// import type { Resident } from '@/types';

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

/* -------------------------------------
   状況ラベル & バッジ（active/preparing/sleeping）
-------------------------------------- */
type Situation = 'active' | 'preparing' | 'sleeping';

function SituationBadge({ situation }: { situation: Situation }) {
  const label =
    situation === 'sleeping'
      ? '就寝中'
      : situation === 'preparing'
      ? '就寝準備中'
      : '活動中';

  const style =
    situation === 'sleeping'
      ? 'bg-gray-200 text-gray-700 border border-gray-300'
      : situation === 'preparing'
      ? 'bg-amber-100 text-amber-800 border border-amber-200'
      : 'bg-emerald-100 text-emerald-800 border border-emerald-200';

  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${style}`}>
      {label}
    </span>
  );
}

/* ----------------------------
   住人タイル（カード風アイテム）
----------------------------- */
// 今はモック（将来 Resident に置換）。status は暫定互換のため残す。
type ResidentLite = {
  id: string;
  name: string;
  status?: 'sleep' | 'active'; // ← 既存ダミー互換
  // 将来：activityTendency?: 'morning'|'normal'|'night';
  // 将来：sleepProfile?: { bedtime: string; wakeTime: string; prepMinutes: number };
};

function ResidentTile({ r, situation }: { r: ResidentLite; situation: Situation }) {
  const disabled = situation === 'sleeping';
  return (
    <div className="relative flex h-32 w-32 flex-shrink-0 flex-col items-center justify-center gap-3 rounded-lg border p-3 text-center">
      {/* 右上バッジ */}
      <span className="absolute right-2 top-2">
        <SituationBadge situation={situation} />
      </span>

      {/* 既存のZzz演出（互換・任意） */}
      {situation === 'sleeping' && (
        <span className="absolute right-2 top-8 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Moon className="h-3 w-3" /> Zzz…
        </span>
      )}

      <div className="font-medium">{r.name}</div>
      <Button size="sm" disabled={disabled} className="min-w-20">
        {disabled ? 'おやすみ中' : '話す'}
      </Button>
    </div>
  );
}

/* ----------------------------
   ページ本体
----------------------------- */
export default function HomePage() {
  // ✅ いまはモック。既存ダミーを維持しつつ「状況バッジ」を動かす
  const residents: ResidentLite[] = [
    { id: 'A', name: 'A', status: 'active' },
    { id: 'B', name: 'B', status: 'sleep' },
    { id: 'C', name: 'C', status: 'active' },
  ];

  // ✅ 実データ導入時の雛形（コメント解除で利用）
  // const residentsFull: Resident[] = useResidents(); // ← 将来の取得フック
  // const now = new Date(); // JST 運用（現実同期）

  // いまはダミー status → Situation に丸める（将来 calcSituation に置換）
  const now = useMemo(() => new Date(), []);
  const residentsWithSituation = useMemo(
    () =>
      residents.map((r) => {
        // ★ 将来ここで calcSituation を使う：
        // const base = r.sleepProfile
        //   ?? (r.activityTendency
        //        ? defaultSleepByTendency(r.activityTendency)
        //        : defaultSleepByTendency('normal'));
        // const sit = calcSituation(now, base);

        // いまは互換：ダミー status から置換
        const sit: Situation = r.status === 'sleep' ? 'sleeping' : 'active';
        return { r, sit };
      }),
    [residents, now]
  );

  const notifications = [
    {
      id: 'chat',
      icon: MessageSquare,
      text: 'A と B が雑談しているようです…',
      href: '#',
      iconClass: 'text-emerald-500',
    },
    {
      id: 'advice',
      icon: Cloud,
      text: 'C から相談があるようです…',
      href: '#',
      iconClass: 'text-sky-500',
    },
    {
      id: 'event',
      icon: AlertTriangle,
      text: 'イベントが開催されます！',
      href: '#',
      iconClass: 'text-amber-500',
    },
  ] as const;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">ホーム</h1>
        <div className="group relative">{/* 右肩のアクション領域（将来） */}</div>
      </div>

      <div className="space-y-6">
        {/* お知らせ（実データ接続 + クリックで会話詳細） */}
        <section>
          <Suspense
            fallback={
              <div className="rounded-2xl border bg-white p-4 text-sm text-gray-500">
                お知らせを読み込み中…
              </div>
            }
          >
            <NotificationsSectionClient />
          </Suspense>
        </section>

        {/* みんなの様子 */}
        <SectionTitle>みんなの様子</SectionTitle>
        <div className="overflow-x-auto">
          <div className="flex gap-4 pb-2">
            {residentsWithSituation.map(({ r, sit }) => (
              <ResidentTile key={r.id} r={r} situation={sit} />
            ))}
          </div>
        </div>

        {/* 今日の新聞（プレースホルダ） */}
        <SectionTitle>今日の新聞</SectionTitle>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            ここにニュースカードを追加予定
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
