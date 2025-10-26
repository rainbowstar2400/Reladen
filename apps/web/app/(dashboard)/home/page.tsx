'use client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
    <div className="relative rounded-lg border p-4">
      {r.status === 'sleep' && (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Moon className="h-3 w-3" /> Zzz…
        </span>
      )}
      <div className="mb-3 font-medium">{r.name}</div>
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

  return (
    <div className="space-y-6">
      {/* おしらせ（ダミー行。将来クリックで遷移可能に） */}
      <SectionTitle>おしらせ</SectionTitle>
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center gap-3 text-sm">
            <MessageSquare className="h-4 w-4 text-emerald-500" />
            <span>A と B が雑談しているようです…</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Cloud className="h-4 w-4 text-sky-500" />
            <span>C から相談があるようです…</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>イベントが開催されます！</span>
          </div>
        </CardContent>
      </Card>

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
