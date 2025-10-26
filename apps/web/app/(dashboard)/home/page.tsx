'use client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { MessageSquare, Cloud, AlertTriangle, Moon } from 'lucide-react'
import React from 'react'

// 見出し（簡易罫線で雰囲気再現）
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 mb-2">
      <h2 className="text-xl font-semibold tracking-wide">{children}</h2>
      <div className="h-px w-full bg-border mt-2" />
    </div>
  )
}

// 住人タイル（将来は DB の resident 配列で map 前提）
// status: 'sleep' ならボタンを disabled、右上に Zzz 表示
type ResidentLite = { id: string; name: string; status?: 'sleep' | 'active' }
function ResidentTile({ r }: { r: ResidentLite }) {
  const disabled = r.status === 'sleep'
  return (
    <div className="relative flex aspect-square flex-col items-center justify-center gap-4 rounded-lg border p-4 text-center">
      {r.status === 'sleep' && (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Moon className="h-3 w-3" /> Zzz…
        </span>
      )}
      <div className="font-medium">{r.name}</div>
      <Button size="sm" disabled={disabled} className="min-w-20">
        話す
      </Button>
    </div>
  )
}

export default function HomePage() {
  // TODO: 将来 useResidents() に差し替え
  const residents: ResidentLite[] = [
    { id: 'A', name: 'A', status: 'active' },
    { id: 'B', name: 'B', status: 'sleep' },
    { id: 'C', name: 'C', status: 'active' },
  ]

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
  ] as const

  return (
    <div className="space-y-6">
      {/* おしらせ（ダミー行。カードごとにリンク化） */}
      <SectionTitle>おしらせ</SectionTitle>
      <div className="grid gap-3">
        {notifications.map(({ id, icon: Icon, text, href, iconClass }) => (
          <Link key={id} href={href} className="block">
            <Card className="transition hover:bg-muted">
              <CardContent className="flex items-center gap-3 py-4 text-sm">
                <Icon className={`h-4 w-4 ${iconClass}`} />
                <span>{text}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* みんなの様子（将来は resident 全件を map） */}
      <SectionTitle>みんなの様子</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {residents.map((r) => (
          <ResidentTile key={r.id} r={r} />
        ))}
      </div>

      {/* 今日の新聞（プレースホルダ） */}
      <SectionTitle>今日の新聞</SectionTitle>
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          ここにニュースカードを追加予定
        </CardContent>
      </Card>
    </div>
  )
}
