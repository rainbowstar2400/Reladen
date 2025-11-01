// apps/web/components/consults/consult-detail-panel.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'

type Line = { speaker: string; text: string }
type Choice = { id: string; label: string }

export type ConsultDetail = {
  id: string
  title: string
  date: string
  weekday: string
  time: string
  prompt: Line
  choices: Choice[]
  replyByChoice?: Record<string, string>
  systemAfter?: string[]
  selectedChoiceId?: string | null
}

export default function ConsultDetailPanel({
  open,
  data,
  onDecide,
}: {
  open: boolean
  data: ConsultDetail | null
  /** 回答確定時に通知（永続化は親側で実行） */
  onDecide?: (choiceId: string) => void
}) {
  const router = useRouter()
  const [picked, setPicked] = useState<string | null>(data?.selectedChoiceId ?? null)
  const answered = useMemo(() => !!(data?.selectedChoiceId ?? picked), [data, picked])

  // Escで閉じる
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.back()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, router])

  // dataの切り替わりで同期
  useEffect(() => {
    setPicked(data?.selectedChoiceId ?? null)
  }, [data?.selectedChoiceId])

  if (!open || !data) return null

  const decide = () => {
    if (!picked) return
    onDecide?.(picked)
  }

  const chosen = data.selectedChoiceId ?? picked ?? null
  const reply =
    chosen && data.replyByChoice?.[chosen]
      ? { speaker: data.prompt.speaker, text: data.replyByChoice[chosen] }
      : null

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
          {/* ヘッダ */}
          <div className="flex items-start justify-between border-b p-4">
            <div className="text-lg font-medium">{data.title}</div>
            <div className="flex items-start gap-4">
              <div className="text-sm text-muted-foreground tabular-nums">
                {data.date} {data.weekday}&nbsp;{data.time}
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

          {/* 本文 */}
          <div className="space-y-4 p-4">
            {/* 相談フキダシ（会話ログ詳細と同じ装飾） */}
            <div className="flex items-start gap-2">
              <div className="w-6 shrink-0 text-sm text-muted-foreground">{data.prompt.speaker}</div>
              <div className="relative max-w-[420px]">
                <div className="rounded-lg border px-3 py-1.5">{data.prompt.text}</div>
                <div className="absolute -left-2 top-3 h-0 w-0 border-y-8 border-y-transparent border-r-8 border-r-border" />
                <div className="absolute -left-[7px] top-[13px] h-0 w-0 border-y-[7px] border-y-transparent border-r-[7px] border-r-background" />
              </div>
            </div>

            {/* 選択肢（未回答=選択可 / 回答後=ロック&強調） */}
            <div className="mt-2 space-y-2">
              {data.choices.map((c) => {
                const isChosen = chosen === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={answered}
                    onClick={() => setPicked(c.id)}
                    className={[
                      'w-full rounded-md border px-3 py-1.5 text-sm transition',
                      answered ? 'cursor-not-allowed' : 'hover:bg-muted',
                      !answered && picked === c.id ? 'ring-2 ring-ring' : '',
                      answered && isChosen ? 'border-foreground/60 bg-muted' : '',
                    ].join(' ')}
                    aria-pressed={!answered && picked === c.id}
                    aria-label={isChosen ? `${c.label}（あなたの回答）` : c.label}
                  >
                    <div className="flex items-center justify-between">
                      <span>{c.label}</span>
                      {isChosen && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Check className="h-4 w-4" />
                          あなたの回答
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}

              {!answered && (
                <div className="flex justify-end pt-2">
                  <Button size="sm" disabled={!picked} onClick={decide}>
                    回答する
                  </Button>
                </div>
              )}
            </div>

            {/* 住人の返答（回答後） */}
            {reply && (
              <div className="mt-4 flex items-start gap-2" aria-live="polite">
                <div className="w-6 shrink-0 text-sm text-muted-foreground">{reply.speaker}</div>
                <div className="relative max-w-[420px]">
                  <div className="rounded-md border px-3 py-1.5">{reply.text}</div>
                  <div className="absolute -left-2 top-3 h-0 w-0 border-y-8 border-y-transparent border-r-8 border-r-border" />
                  <div className="absolute -left-[7px] top-[13px] h-0 w-0 border-y-[7px] border-y-transparent border-r-[7px] border-r-background" />
                </div>
              </div>
            )}

            {/* SYSTEM 行（信頼度変化など。回答後のみ） */}
            {answered && data.systemAfter && data.systemAfter.length > 0 && (
              <div className="mt-6 space-y-2 text-sm text-muted-foreground">
                {data.systemAfter.map((s, i) => (
                  <p key={i}>{s}</p>
                ))}
              </div>
            )}
          </div>

          {/* フッタ（前/閉じる/次） */}
          <div className="mt-auto flex items-center justify-between gap-2 border-t p-3">
            <button className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              <ChevronLeft className="h-4 w-4" />
              前の相談
            </button>
            <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => router.back()}>
              閉じる
            </button>
            <button className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              次の相談
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </motion.aside>
      </div>
    </AnimatePresence>
  )
}
