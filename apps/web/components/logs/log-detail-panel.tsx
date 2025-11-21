'use client'
import { useEffect } from 'react'
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
          <div className="flex items-start justify-between border-b p-4">
            <div className="text-lg font-medium">{data.title}</div>
            <div className="flex items-start gap-4">
              <div className="text-sm text-muted-foreground tabular-nums">
                {data.date} {data.weekday}&nbsp;
                {data.time}
              </div>
              <button
                onClick={() => router.back()}
                className="rounded-md p-1 hover:bg-muted"
                aria-label="閉じる"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="space-y-3 p-4">
            {data.lines.map((line, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="shrink-0 py-2 text-sm font-medium text-foreground">{line.speaker}</div>
                <div className="relative max-w-[420px]">
                  <div className="rounded-lg bg-muted px-3 py-2">{line.text}</div>
                  <div className="absolute -left-2 top-3 h-0 w-0 border-y-8 border-y-transparent border-r-8 border-r-muted" />
                </div>
              </div>
            ))}
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
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => router.back()}>
              閉じる
            </button>
            <button className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              次の会話<ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
  )
}
