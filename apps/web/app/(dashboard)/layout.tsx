import type { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { MotionMain } from '@/components/layout/motion-main'

export default function DashboardLayout({
  children,
  detail,
}: {
  children: ReactNode
  detail?: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr]">
        <Sidebar />
        <MotionMain>{children}</MotionMain>
      </div>
      {detail}
    </div>
  )
}
