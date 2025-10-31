'use client'
import { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MotionMain } from '@/components/layout/motion-main'
import LogDetailPanel, { LogDetail } from '@/components/logs/log-detail-panel'

function makeDummy(id: string): LogDetail {
  return {
    id,
    title: 'AとBが雑談している。',
    date: '2025/10/22',
    weekday: 'Wed',
    time: '23:15',
    lines: [
      { speaker: 'A', text: 'フキダシ' },
      { speaker: 'B', text: 'フキダシ' },
      { speaker: 'A', text: 'フキダシ' },
    ],
    system: [
      'A→Bの好感度が上昇した！',
      'B→Aの好感度が上昇した！',
      'A→Bの印象が「なし」に変化した。',
    ],
  }
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const logId = searchParams.get('log')
  const data = logId ? makeDummy(logId) : null

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[16rem_1fr]">
        <Sidebar />
        <MotionMain>{children}</MotionMain>
      </div>
      <LogDetailPanel open={!!logId} data={data} />
    </div>
  )
}
