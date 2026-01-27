'use client'
import { DeskPanel } from '@/components/room/desk-panel'
import { ReportContent } from '@/components/room/report-content'

export default function ReportsPage() {
  return (
    <DeskPanel className="mx-auto mt-[clamp(20px,3vw,44px)] w-[min(100%,980px)]">
      <ReportContent />
    </DeskPanel>
  )
}
