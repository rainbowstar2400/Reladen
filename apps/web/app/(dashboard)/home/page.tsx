'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MessageSquare, Cloud, AlertTriangle, Moon } from 'lucide-react';
import React, { useMemo } from 'react';
import NotificationsSectionClient from '@/components/notifications/NotificationsSection.client';
import { Suspense } from 'react';
import { calcSituation, defaultSleepByTendency, type Situation } from '@/lib/schedule';
import { useEffect, useState } from 'react';
import { listLocal } from '@/lib/db-local';
import type { Resident } from '@/types';

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
// 住人タイル表示用の最小限の型
type ResidentLite = {
  id: string;
  name: string;
  // ★ 以前のダミーデータ互換 'status' プロパティは不要なため削除
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
        {disabled ? '就寝中' : '話す'}
      </Button>
    </div>
  );
}

/* ----------------------------
   ページ本体
----------------------------- */
export default function HomePage() {
  // 実データ（IndexedDB）から取得
  const [residents, setResidents] = useState<Resident[]>([]);

  // 1分ごとに tick して再レンダを促す。都度 new Date() を評価して calcSituation に渡す。
  const [tick, setTick] = useState(0);

  // 1分ごとに tick して再レンダを促す
  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // マウント時に IndexedDB から住人を読み込む
  useEffect(() => {
    let alive = true;
    (async () => {
      const rows = await listLocal('residents');
      if (alive) setResidents(rows as Resident[]);
    })();
    return () => { alive = false; };
  }, []);

  const now = new Date();

  const residentsWithSituation = useMemo(
    () =>
      residents.map((r) => {
        // Resident 側に sleepProfile / activityTendency がある場合は calcSituation を使用
        // どちらも無い場合は「活動中」フォールバック
        const hasProfile = (r as any).sleepProfile || (r as any).activityTendency;
        let sit: Situation;
        if (hasProfile) {
          const base =
            (r as any).sleepProfile ??
            defaultSleepByTendency((r as any).activityTendency ?? 'normal');
          sit = calcSituation(now, base);
        } else {
          sit = 'active';
        }

        // ResidentTile は name / id があれば表示できる
        const lite: ResidentLite = {
          id: (r as any).id,
          name: (r as any).name ?? '',
        };
        return { r: lite, sit };
      }),
    [residents, now]
  );


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
            {residentsWithSituation.length === 0 ? (
              <div className="text-sm text-muted-foreground px-2 py-1">住人がいません。</div>
            ) : (
              residentsWithSituation.map(({ r, sit }) => (
                <ResidentTile key={r.id} r={r} situation={sit} />
              ))
            )}
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