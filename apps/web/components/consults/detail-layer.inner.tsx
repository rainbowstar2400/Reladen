// apps/web/components/consults/detail-layer.inner.tsx
'use client'

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
    selectedChoiceId: loadConsultAnswer(id)?.selectedChoiceId ?? null,
  }
}

export default function ConsultDetailLayerInner() {
  const sp = useSearchParams()
  const consultId = sp.get('consult')
  const data = consultId ? makeDummy(consultId) : null

  return (
    <ConsultDetailPanel
      open={!!consultId}
      data={data}
      onDecide={(choiceId) => {
        if (!consultId) return
        saveConsultAnswer(consultId, choiceId)
        // 必要ならトーストやSentry送信などをここに
      }}
    />
  )
}
