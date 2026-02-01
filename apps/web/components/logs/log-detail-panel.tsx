'use client'
import { Fragment, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
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
  const bubbleBg = 'rgba(255,255,255,0.6)';
  const bubbleBorder = 'rgba(85,85,85,0.8)';
  return (
    <>
      <div className="flex items-start justify-between border-b p-4">
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

      <div className="p-4">
        <div className="space-y-4 p-4 pb-20">
          {data.lines.map((line, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="shrink-0 whitespace-nowrap text-right text-sm font-medium text-slate-600">
                {line.speaker}
              </div>
              <div className="relative max-w-[400px]">
                                <div
                  className="rounded-[14px] px-[14px] py-[10px] text-sm leading-relaxed text-slate-700"
                  style={{
                    border: `2px solid ${bubbleBorder}`,
                    boxSizing: 'border-box',
                    backgroundColor: bubbleBg,
                  }}
                >
                  {line.text}
                </div>
                {/* 外側（三角：枠色） */}
                <div
                  className="absolute left-[-24px] top-1/2 h-0 w-0 -translate-y-1/2 border-[12px] border-transparent"
                  style={{ borderRightColor: bubbleBorder, zIndex: 1 }}
                  aria-hidden="true"
                />
                {/* 内側（三角：背景色） */}
                <div
                  className="absolute left-[-23px] top-1/2 h-0 w-0 -translate-y-1/2 border-[11px] border-transparent"
                  style={{ borderRightColor: bubbleBg, zIndex: 2 }}
                  aria-hidden="true"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-3 text-base leading-relaxed text-foreground">
          {data.system.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t p-3">
        <button className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
          <ChevronLeft className="h-4 w-4" />前の会話
        </button>
        <button className="rounded-md border px-3 py-1.5 text-sm" onClick={onClose}>
          閉じる
        </button>
        <button className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
          次の会話<ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </>
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
