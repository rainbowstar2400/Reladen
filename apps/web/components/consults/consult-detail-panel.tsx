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
  selectedChoiceId?: string | null // ← ここは「確定済み」を示す入力値
}

export default function ConsultDetailPanel({
  open,
  data,
  onDecide,
}: {
  open: boolean
  data: ConsultDetail | null
  /** 「回答する」押下で確定したときだけ呼ぶ（永続化は親側で） */
  onDecide?: (choiceId: string) => void
}) {
  const router = useRouter()

  // 一時選択（未確定）。クリックで何度でも変更可
  const [picked, setPicked] = useState<string | null>(null)
  // 確定済み選択（回答後に固定）。初期値は data.selectedChoiceId を反映
  const [committed, setCommitted] = useState<string | null>(data?.selectedChoiceId ?? null)

  // data が切り替わったときは committed を同期（picked は未操作に戻す）
  useEffect(() => {
    setCommitted(data?.selectedChoiceId ?? null)
    setPicked(null)
  }, [data?.selectedChoiceId])

  const answered = useMemo(() => committed != null, [committed])

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

  // 「回答する」— picked を確定させ、保存フックを呼ぶ
  const decide = () => {
    if (!picked) return
    setCommitted(picked)      // ここで確定
    onDecide?.(picked)        // ← 保存はこのタイミングだけ
  }

  // 強調・バッジ・返答は「確定済み」のみ対象
  const chosenForHighlight = committed
  const reply =
    committed && data.replyByChoice?.[committed]
      ? { speaker: data.prompt.speaker, text: data.replyByChoice[committed] }
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
            {/* 相談フキダシ */}
            <div className="flex items-start gap-2">
              <div className="w-6 shrink-0 text-sm text-muted-foreground">{data.prompt.speaker}</div>
              <div className="relative max-w-[420px]">
                <div className="rounded-lg border px-3 py-1.5">{data.prompt.text}</div>
                <div className="absolute -left-2 top-3 h-0 w-0 border-y-8 border-y-transparent border-r-8 border-r-border" />
                <div className="absolute -left-[7px] top-[13px] h-0 w-0 border-y-[7px] border-y-transparent border-r-[7px] border-r-background" />
              </div>
            </div>

            {/* 選択肢 */}
            <div className="mt-2 space-y-2">
              {data.choices.map((c) => {
                const isCommitted = chosenForHighlight === c.id
                const isPicked = picked === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={answered} // 回答確定後は変更不可
                    onClick={() => setPicked(c.id)}
                    className={[
                      'w-full rounded-md border px-3 py-1.5 text-sm transition',
                      answered ? 'cursor-not-allowed' : 'hover:bg-muted',
                      !answered && isPicked ? 'ring-2 ring-ring' : '',
                      answered && isCommitted ? 'border-foreground/60 bg-muted' : '',
                    ].join(' ')}
                    aria-pressed={!answered && isPicked}
                    aria-label={
                      isCommitted ? `${c.label}（あなたの回答）` :
                      isPicked && !answered ? `${c.label}（選択中）` : c.label
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span>{c.label}</span>
                      {isCommitted && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Check className="h-4 w-4" />
                          あなたの回答
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}

              {/* 回答ボタン：未確定時のみ表示。未選択なら無効 */}
              {!answered && (
                <div className="flex justify-end pt-2">
                  <Button size="sm" disabled={!picked} onClick={decide}>
                    回答する
                  </Button>
                </div>
              )}
            </div>

            {/* 住人の返答（確定後） */}
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

            {/* SYSTEM 行（確定後） */}
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
