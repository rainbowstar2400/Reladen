'use client'
import { useParams } from 'next/navigation'
import { LogDetailPanel } from '@/components/logs/log-detail-panel'

// ダミーデータ生成（idに合わせて適当な内容）
function makeDummy(id: string) {
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
  } as const
}

export default function LogDetailInterceptPage() {
  const params = useParams() as { id: string }
  const data = makeDummy(params.id)
  return <LogDetailPanel open data={data} />
}
