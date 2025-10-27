'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type Line = { speaker: 'A'|'B'|'C'; text: string }
type LogDetail = {
  id: string
  title: string           // 例: "AとBが雑談している。"
  date: string            // 例: "2025/10/22"
  weekday: string         // 例: "Wed"
  time: string            // 例: "23:15"
  lines: Line[]
  system: string[]        // SYSTEM文
}

export function LogDetailPanel({
  open, data,
}: { open: boolean; data: LogDetail }) {
  const router = useRouter()

  // ESCで閉じる
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') router.back() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, router])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          {/* 背景クリックで閉じる（非ブラー） */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => router.back()}
            aria-hidden
          />

          {/* パネル（右からスライド） */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-background shadow-xl"
            role="dialog" aria-modal={false}
          >
            {/* ヘッダー */}
            <div className="flex items-start justify-between border-b p-4">
              <div className="pr-3">
                <div className="text-lg font-medium">{data.title}</div>
              </div>
              <div className="flex items-start gap-4">
                <div className="text-sm text-muted-foreground tabular-nums">
                  {data.date} {data.weekday} &nbsp; {data.time}
                </div>
                <button
                  className="rounded-md p-1 hover:bg-muted"
                  onClick={() => router.back()}
                  aria-label="閉じる"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* 本文 */}
            <div className="space-y-6 p-4">
              {/* セリフ行 */}
              <div className="space-y-3">
                {data.lines.map((ln, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-6 shrink-0 text-sm text-muted-foreground">{ln.speaker}</div>
                    {/* 吹き出し：枠＋三角 */}
                    <div className="relative max-w-[420px]">
                      <div className="rounded-lg border px-3 py-1.5">{ln.text}</div>
                      <div className="absolute -left-2 top-3 h-0 w-0 border-y-8 border-y-transparent border-r-8 border-r-border" />
                      <div className="absolute -left-[7px] top-[13px] h-0 w-0 border-y-[7px] border-y-transparent border-r-[7px] border-r-background" />
                    </div>
                  </div>
                ))}
              </div>

              {/* SYSTEM文 */}
              <div className="space-y-2 text-sm leading-7 text-muted-foreground">
                {data.system.map((s, i) => (<p key={i}>{s}</p>))}
              </div>
            </div>

            {/* フッター：前/閉じる/次（ダミー） */}
            <div className="mt-auto flex items-center justify-between gap-2 border-t p-3">
              <button className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                <ChevronLeft className="h-4 w-4" /> 前の会話
              </button>
              <button className="rounded-md border px-3 py-1.5 text-sm" onClick={()=>router.back()}>
                閉じる
              </button>
              <button className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                次の会話 <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
