'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MessageSquare, Cloud, AlertTriangle, Moon, Loader2 } from 'lucide-react';
import React, { useMemo } from 'react';
import NotificationsSectionClient from '@/components/notifications/NotificationsSection.client';
import { Suspense } from 'react';
import {
  calcSituation,
  defaultSleepByTendency,
  getOrGenerateTodaySchedule,
  type Situation,
  type SleepProfile,
  type BaseSleepProfile,
  type ActivityTendency,
} from '../../../../../packages/shared/logic/schedule';
import { useEffect, useState } from 'react';
import { useResidents } from '@/lib/data/residents';
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
    situation === 'preparing'
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
};

function ResidentTile({ r, situation }: { r: ResidentLite; situation: Situation }) {
  const disabled = situation === 'sleeping';
  return (
    <div className="relative flex h-32 w-32 flex-shrink-0 flex-col items-center justify-end gap-3 rounded-lg border p-3 text-center">
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
  // useResidents フックからデータを取得
  const { data: residents = [], isLoading: isLoadingResidents } = useResidents();

  // 1分ごとに tick して再レンダを促す。都度 new Date() を評価して calcSituation に渡す。
  const [tick, setTick] = useState(0);

  // 1分ごとに tick して再レンダを促す
  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const now = new Date();

  // 型エイリアスを定義 (map の引数で使用)
  type SituationEntry = { r: ResidentLite, sit: Situation };

  const residentsWithSituation = useMemo(
    () => {
      // useResidents から取得した residents を使用
      return residents.map((r) => {
        const profile = (r as any).sleepProfile as SleepProfile | undefined;
        let sit: Situation;

        // useResidents ですでにスケジュール処理済み
        if (profile && profile.todaySchedule) {
          // 新しい calcSituation を呼ぶ
          sit = calcSituation(now, profile);
        } else {
          // プロファイルがないか、今日のスケジュールが生成できなかった場合
          sit = 'active';
        }

        // ResidentTile は name / id があれば表示できる
        const lite: ResidentLite = {
          id: (r as any).id,
          name: (r as any).name ?? '',
        };
        return { r: lite, sit };
      });
    },
    [residents, now] // tick で 'now' が更新されるたびに再計算
  );


  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">ホーム</h1>
        <div className="group relative">{/* 右肩のアクション領域（将来） */}</div>
      </div>

      <div className="space-y-6">
        {/* お知らせ（実データ接続 + クリックで会話詳細） */}
        <section className="rounded-2xl border bg-white p-4 text-sm text-gray-500">
          <Suspense
            fallback={
              <p>お知らせを読み込み中…</p>
            }
          >
            <NotificationsSectionClient />
          </Suspense>
        </section>

        {/* みんなの様子 */}
        <SectionTitle>みんなの様子</SectionTitle>

        <div className="overflow-x-auto">
          <div className="flex gap-4 pb-2">
            {/* ローディング状態を追加 */}
            {isLoadingResidents ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-2 py-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                読み込み中…
              </div>
            ) : residentsWithSituation.length === 0 ? (
              <div className="text-sm text-muted-foreground px-2 py-1">住人がいません。</div>
            ) : (
              residentsWithSituation.map(({ r, sit }: SituationEntry) => (
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