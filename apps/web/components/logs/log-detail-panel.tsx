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

          <div className="p-4">
            <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-4 items-start p-4 pb-20">
              {data.lines.map((line, index) => (
                <Fragment key={index}>
                  <div className="text-sm font-medium text-foreground text-center py-2 whitespace-nowrap">
                    {line.speaker}
                  </div>
                  <div className="relative max-w-[400px]">
                    <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2 text-sm leading-relaxed">
                      {line.text}
                    </div>
                    <div
                      className="absolute left-[-6px] top-3 h-0 w-0 border-y-[6px] border-r-[8px] border-y-transparent border-r-muted"
                      aria-hidden="true"
                    />
                  </div>
                </Fragment>
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
