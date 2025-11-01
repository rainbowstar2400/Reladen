import { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MotionMain } from '@/components/layout/motion-main'
import DetailLayer from '@/components/logs/detail-layer'
import ConsultDetailLayer from '@/components/consults/detail-layer' // ← すでにありますね！

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="grid flex-1 grid-cols-1 md:grid-cols-[16rem_1fr]">
        <Sidebar />
        <MotionMain>{children}</MotionMain>
      </div>

      {/* --- モーダルレイヤ（スライドイン表示） --- */}
      <DetailLayer />          {/* 会話ログ詳細（既存） */}
      <ConsultDetailLayer />   {/* 相談ログ詳細（今回追加） */}
    </div>
  )
}
