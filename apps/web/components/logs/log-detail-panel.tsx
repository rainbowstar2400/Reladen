'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type Line = { speaker: string; text: string }
export type LogDetail = {
  id: string
  title: string
  date: string
  weekday: string
  time: string
  lines: Line[]
  system: string[]
}

export function LogDetailPanelContent({
  data,
  onClose,
}: {
  data: LogDetail;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 flex items-start justify-between border-b p-4">
        <div className="text-lg font-medium">{data.title}</div>
        <div className="flex items-start gap-4">
          <div className="text-sm text-muted-foreground tabular-nums">
            {data.date} {data.weekday}&nbsp;
            {data.time}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted"
            aria-label="閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="desk-panel-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">
        <div className="space-y-2 px-4 py-2">
          {data.lines.map((line, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="shrink-0 whitespace-nowrap text-right text-sm font-medium text-slate-600">
                {line.speaker}
              </div>
              <div className="ml-3 max-w-[400px]">
                <div className="speech-bubble text-sm text-slate-700">
                  {line.text}
                </div>
              </div>
            </div>
          ))}
        </div>
        {data.system.length > 0 && (
          <div className="mt-1.5 space-y-0.5 px-4 pb-4 text-base text-slate-700">
            {data.system.map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LogDetailPanel({ open, data }: { open: boolean; data: LogDetail | null }) {
  const router = useRouter()
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.back()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, router])

  if (!open || !data) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/30" onClick={() => router.back()} />
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-background shadow-xl"
          role="dialog"
          aria-modal={false}
        >
          <LogDetailPanelContent data={data} onClose={() => router.back()} />
        </motion.aside>
      </div>
    </AnimatePresence>
  )
}
