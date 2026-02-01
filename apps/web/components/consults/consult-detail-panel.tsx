// apps/web/components/consults/consult-detail-panel.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Check } from 'lucide-react'
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

export function ConsultDetailPanelContent({
  data,
  onDecide,
  onClose,
}: {
  data: ConsultDetail
  /** 「回答する」押下で確定したときだけ呼ぶ（永続化は親側で） */
  onDecide?: (choiceId: string) => void
  onClose?: () => void
}) {
  const router = useRouter()
  const bubbleBg = 'rgba(255,255,255,0.6)'
  const bubbleBorder = 'rgba(85,85,85,0.8)'

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

  // dataの切り替わりで同期
  useEffect(() => {
    setPicked(data?.selectedChoiceId ?? null)
  }, [data?.selectedChoiceId])

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
    <>
      {/* ヘッダ */}
      <div className="flex items-start justify-between border-b p-4">
        <div className="text-lg font-medium">{data.title}</div>
        <div className="flex items-start gap-4">
          <div className="text-sm text-muted-foreground tabular-nums">
            {data.date} {data.weekday}&nbsp;{data.time}
          </div>
          <button
            onClick={onClose ?? (() => router.back())}
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
        <div className="text-base leading-relaxed text-slate-700">{data.prompt.text}</div>

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
                  'w-full rounded-md border border-slate-300/80 bg-white/40 px-3 py-1.5 text-sm text-slate-700 transition',
                  answered ? 'cursor-not-allowed' : 'hover:bg-white/55',
                  !answered && isPicked ? 'ring-2 ring-ring' : '',
                  answered && isCommitted ? 'border-slate-500/70 bg-white/65' : '',
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
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
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
          <div className="mt-4 text-base leading-relaxed text-slate-700" aria-live="polite">
            {reply.text}
          </div>
        )}

        {/* SYSTEM 行（確定後） */}
        {answered && data.systemAfter && data.systemAfter.length > 0 && (
          <div className="mt-6 space-y-2 text-base text-muted-foreground">
            {data.systemAfter.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
          </div>
        )}
      </div>

    </>
  )
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
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.back()
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
          <ConsultDetailPanelContent
            data={data}
            onDecide={onDecide}
            onClose={() => router.back()}
          />
        </motion.aside>
      </div>
    </AnimatePresence>
  )
}
