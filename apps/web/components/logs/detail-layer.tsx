'use client'

import { useSearchParams } from 'next/navigation'
import LogDetailPanel, { LogDetail } from '@/components/logs/log-detail-panel'

// TODO: 後で useConversationLog(id) に差し替え
function makeDummy(id: string): LogDetail {
  return {
    id,
    title: 'AとBが雑談している。',
    date: '2025/10/22',
    weekday: 'Wed',
    time: '23:15',
    lines: [
      { speaker: 'A', text: 'フキダシ' },
      { speaker: 'B', text: 'フキダシ' },
      { speaker: 'A', text: 'フキダシ' },
    ],
    system: [
      'A→Bの好感度が上昇した！',
      'B→Aの好感度が上昇した！',
      'A→Bの印象が「なし」に変化した。',
    ],
  }
}

export default function DetailLayer() {
  const searchParams = useSearchParams()
  const logId = searchParams.get('log')
  const data = logId ? makeDummy(logId) : null

  return <LogDetailPanel open={!!logId} data={data} />
}
