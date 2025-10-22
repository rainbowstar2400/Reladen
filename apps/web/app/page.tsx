'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSync } from '@/lib/sync/use-sync'

type SyncPhase = ReturnType<typeof useSync>['phase']

type Announcement = {
  id: string
  category: '会話' | '相談' | 'イベント'
  summary: string
  time: string
}

type ResidentStatus = {
  id: string
  name: string
  status: string
}

const ANNOUNCEMENTS: Announcement[] = [
  { id: 'c-001', category: '会話', summary: 'あかねさんとみどりさんが居間で近況報告をしました。', time: '08:15' },
  { id: 's-002', category: '相談', summary: 'そらさんが図書室で将来の進路について相談したい様子です。', time: '09:30' },
  { id: 'e-003', category: 'イベント', summary: '今夜18時から共有スペースの軽い片づけを行います。', time: '18:00' },
]

const RESIDENTS: ResidentStatus[] = [
  { id: 'akane', name: 'あかね', status: '中庭で植物の世話中' },
  { id: 'midori', name: 'みどり', status: '街へ買い出しに外出中' },
  { id: 'sora', name: 'そら', status: '自室で音楽制作をしています' },
  { id: 'hinata', name: 'ひなた', status: '談話室でボードゲームを準備中' },
]

const RELATION_UPDATES = [
  {
    pair: ['あかね', 'みどり'],
    detail: '朝の庭仕事で協力し、親密度が +1 上昇しました。',
  },
  {
    pair: ['そら', 'ひなた'],
    detail: '夜のカードゲームで対戦し、フランクさが +2 変化しました。',
  },
]

const CONTRIBUTIONS = [
  {
    author: 'れん',
    text: '共同キッチンの調味料が少なくなっています。補充のメモを掲示板に貼りました。',
  },
  {
    author: 'みどり',
    text: '朝の散歩で見つけた小さな花をリビングに飾りました。よかったら見てください。',
  },
]

const SYNC_COLORS: Record<SyncPhase, { label: string; className: string }> = {
  online: { label: 'online', className: 'border-emerald-500 text-emerald-600 dark:text-emerald-400' },
  offline: { label: 'offline', className: 'border-muted-foreground text-muted-foreground' },
  syncing: { label: 'syncing', className: 'border-primary text-primary' },
  error: { label: 'error', className: 'border-destructive text-destructive' },
}

function useCurrentTime() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 60_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  return now
}

export default function HomePage() {
  const now = useCurrentTime()
  const { phase } = useSync()

  const formattedDate = useMemo(
    () =>
      now.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }),
    [now]
  )

  const formattedTime = useMemo(
    () =>
      now.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [now]
  )

  const syncVisual = SYNC_COLORS[phase]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">ホーム</h1>
        <p className="text-sm text-muted-foreground">居住区の概要をここで確認できます。</p>
      </header>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>世界情報</CardTitle>
                <CardDescription>今日の空気感や時間を確認できます。</CardDescription>
              </div>
              <Badge variant="outline" className={cn('px-3 py-1 text-xs font-semibold', syncVisual.className)}>
                {syncVisual.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">日付</span>
              <time dateTime={now.toISOString()} className="text-base font-medium">
                {formattedDate}
              </time>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">現在時刻</span>
              <time dateTime={now.toISOString()} className="text-lg font-semibold tracking-wide">
                {formattedTime}
              </time>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">天気</span>
              <p>
                <span className="font-medium">薄曇りのち晴れ</span>
                <span className="ml-2 text-muted-foreground">午後は穏やかな南風が吹く予報です。</span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>おしらせ</CardTitle>
            <CardDescription>会話やイベントの速報です。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ANNOUNCEMENTS.map((item) => (
              <Link
                key={item.id}
                href={`/logs/${item.id}`}
                className="block rounded-md border border-transparent px-3 py-2 transition hover:border-muted hover:bg-muted/40"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold">{item.category}</span>
                  <time dateTime={item.time} className="tabular-nums">
                    {item.time}
                  </time>
                </div>
                <p className="mt-1 text-sm leading-6">{item.summary}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>みんなの様子</CardTitle>
            <CardDescription>今の行動をざっくり記録しています。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {RESIDENTS.map((resident) => (
              <div
                key={resident.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-muted px-3 py-2"
              >
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">
                    <span>{resident.name}</span>
                  </p>
                  <p className="text-muted-foreground">{resident.status}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log(`話すボタン: ${resident.name}`)
                  }}
                >
                  話す
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="xl:row-span-2">
          <CardHeader>
            <CardTitle>新聞</CardTitle>
            <CardDescription>昨日までの動きと今日の運勢をまとめています。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <section className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">発行日</h3>
              <time dateTime={now.toISOString()} className="text-base font-medium">
                {formattedDate}
              </time>
            </section>
            <section className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">天気ひとこと</h3>
              <p>
                <span className="font-medium">「雲の切れ間から日差しがのぞく一日」</span>
                <span className="ml-2 text-muted-foreground">洗濯物は午前中のうちに干すと安心です。</span>
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">関係の変化</h3>
              <ul className="space-y-2">
                {RELATION_UPDATES.map((item, index) => (
                  <li key={index} className="leading-6">
                    <span className="font-semibold">{item.pair[0]}</span>
                    <span className="mx-1 text-muted-foreground">と</span>
                    <span className="font-semibold">{item.pair[1]}</span>
                    <span className="ml-2 text-muted-foreground">{item.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">新しい仲間</h3>
              <p>
                <span className="font-medium">つばさ</span>
                <span className="ml-2 text-muted-foreground">夕方に引っ越し予定。荷解きの手伝いを募集中です。</span>
              </p>
            </section>
            <section className="space-y-1">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">今日の占い</h3>
              <p>
                <span className="font-medium">ラッキーカラーは藍色。</span>
                <span className="ml-2 text-muted-foreground">ストレッチで体をほぐすと会話が弾むかもしれません。</span>
              </p>
            </section>
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">寄稿欄</h3>
              <ul className="space-y-3">
                {CONTRIBUTIONS.map((item, index) => (
                  <li key={index} className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">{item.author}より</p>
                    <p className="leading-6">{item.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
