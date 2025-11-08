'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useResidents } from '@/lib/data/residents'

export default function OfficePage() {
  const { data, isLoading } = useResidents()
  const count = isLoading ? '—' : (data?.length ?? 0)

  const Btn = ({ href, label }: { href: string; label: string }) => (
    <Button asChild variant="outline" className="h-16 w-full rounded-2xl text-lg">
      <Link href={href}>{label}</Link>
    </Button>
  )

  return (
    <div className="space-y-8">
      {/* タイトル行 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">管理室</h1>
        <p className="text-sm">
          現在の総住人数：<span className="tabular-nums text-base font-semibold">{count}</span> 人
        </p>
      </div>

      {/* 大きめボタンを中央縦並び */}
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <Btn href="/office/residents" label="住人一覧" />
        <Btn href="/office/new" label="新規住人登録" />
        <Btn href="/office/presets" label="プリセット管理" />
      </div>
    </div>
  )
}
