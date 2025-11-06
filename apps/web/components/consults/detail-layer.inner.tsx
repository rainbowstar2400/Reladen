// apps/web/components/consults/detail-layer.inner.tsx
'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import ConsultDetailPanel, { ConsultDetail } from './consult-detail-panel'
import { loadConsultAnswer, saveConsultAnswer } from '@/lib/client/consult-storage'

function makeDummy(id: string): ConsultDetail {
  // TODO: 後で DB 取得に差し替え
  return {
    id,
    title: 'Cから相談を受けた。',
    date: '2025/10/22',
    weekday: 'Wed',
    time: '23:15',
    prompt: { speaker: 'C', text: 'フキダシ' },
    choices: [
      { id: 'c1', label: '選択肢 1' },
      { id: 'c2', label: '選択肢 2' },
      { id: 'c3', label: '選択肢 3' },
    ],
    replyByChoice: {
      c1: '（Cの返答例）なるほど、やってみるね。',
      c2: '（Cの返答例）うん、少し気が楽になったかも。',
      c3: '（Cの返答例）ありがとう、助かった！',
    },
    systemAfter: ['Cからの信頼度が上昇した！'],
    // ※ 非同期で復元するため、ここでは null を入れておく
    selectedChoiceId: null,
  }
}

export default function ConsultDetailLayerInner() {
  const sp = useSearchParams()
  const consultId = sp.get('consult')
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null)

  useEffect(() => {
    let aborted = false
      ; (async () => {
        if (!consultId) {
          setSelectedChoiceId(null)
          return
        }
        try {
          const stored = await loadConsultAnswer(consultId)
          if (!aborted) setSelectedChoiceId(stored?.selectedChoiceId ?? null)
        } catch {
          if (!aborted) setSelectedChoiceId(null)
        }
      })()
    return () => { aborted = true }
  }, [consultId])

  const data = useMemo(
    () => (consultId ? { ...makeDummy(consultId), selectedChoiceId } : null),
    [consultId, selectedChoiceId]
  )

  return (
    <ConsultDetailPanel
      open={!!consultId}
      data={data}
      onDecide={async (choiceId) => {
        if (!consultId) return
        await saveConsultAnswer(consultId, choiceId)
        setSelectedChoiceId(choiceId ?? null) // UIへ即反映
        // 必要ならトーストやSentry送信などをここに
      }}
    />
  )
}
