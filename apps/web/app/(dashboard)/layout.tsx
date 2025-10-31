import { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MotionMain } from '@/components/layout/motion-main'
import DetailLayer from '@/components/logs/detail-layer'

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
      <DetailLayer />
    </div>
  )
}
