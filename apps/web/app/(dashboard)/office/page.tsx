'use client'
import { DeskPanel } from '@/components/room/desk-panel'
import { OfficeContent } from '@/components/room/office-content'

export default function OfficePage() {
  return (
    <DeskPanel className="mx-auto mt-[clamp(24px,3vw,56px)] w-[min(100%,960px)]">
      <OfficeContent />
    </DeskPanel>
  )
}
