// apps/web/app/(dashboard)/consults/[id]/page.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import ConsultDetailPanel, { ConsultDetail } from '@/components/consults/consult-detail-panel'
import { loadConsultAnswer, saveConsultAnswer } from '@/lib/client/consult-storage'
import { useSync } from '@/lib/sync/use-sync'

// API からの応答（/api/consults/[id]）を既存 UI が要求する ConsultDetail に正規化
function normalizeToConsultDetail(apiData: any, id: string): ConsultDetail {
  // サーバー側 route.ts で { consult: {...} } 形式を返す想定
  const src = apiData?.consult ?? apiData ?? {}
  const p = src?.payload ?? src?.data ?? src ?? {}

  // --- 日付／時刻の整形（ダミー互換: date, weekday, time） ---
  const updatedISO: string | undefined =
    src?.updated_at || p?.updated_at || p?.occurredAt || undefined
  const d = updatedISO ? new Date(updatedISO) : new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]

  // --- プロンプト（話者と吹き出し文） ---
  const prompt = {
    speaker: p?.speaker ?? p?.residentName ?? p?.from ?? 'Someone',
    text: p?.text ?? p?.content ?? p?.body ?? '',
  }

  // --- 選択肢 ---
  const choicesRaw: any[] =
    Array.isArray(p?.choices) ? p.choices : Array.isArray(p?.options) ? p.options : []
  const choices: ConsultDetail['choices'] = choicesRaw.map((c, idx) => ({
    id: String(c?.id ?? c?.value ?? `c${idx + 1}`),
    label: String(c?.label ?? c?.text ?? c ?? `選択肢 ${idx + 1}`),
  }))

  // --- 選択肢ごとの返答（なければ空オブジェクト） ---
  const replyEntries =
    p?.replyByChoice ??
    p?.replies ??
    {}
  const replyByChoice: ConsultDetail['replyByChoice'] = Object.fromEntries(
    Object.entries(replyEntries).map(([k, v]) => [String(k), String(v as any)])
  )

  // --- システム結果（なければ空配列） ---
  const systemAfter: string[] = Array.isArray(p?.systemAfter)
    ? p.systemAfter.map(String)
    : []

  return {
    id: src?.id ?? id,
    title: p?.title ?? p?.subject ?? '相談',
    date: `${yyyy}/${mm}/${dd}`,
    weekday,
    time: `${hh}:${mi}`,
    prompt,
    choices,
    replyByChoice,
    systemAfter,
    // selectedChoiceId は非同期で別途読み込み
    selectedChoiceId: null,
  }
}

export default function ConsultDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { sync } = useSync();

  const [data, setData] = useState<ConsultDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let aborted = false
    async function run() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/consults/${id}`, { cache: 'no-store' })
        if (!res.ok) {
          // 404/500 などもここに入る
          throw new Error(`failed to load consult (${res.status})`)
        }
        const json = await res.json()
        if (aborted) return
        // 1) 本体を正規化
        const base = normalizeToConsultDetail(json, id)
        // 2) 回答の復元（IndexedDBへ移行済: 非同期）
        const stored = await loadConsultAnswer(base.id)
        if (aborted) return
        setData({
          ...base,
          selectedChoiceId: stored?.selectedChoiceId ?? null,
        })
      } catch (e: any) {
        if (!aborted) {
          setError(e?.message ?? 'failed to load consult')
          // フォールバック：空のスケルトンを最低限で表示（UI崩れ防止）
          setData(
            normalizeToConsultDetail(
              {
                consult: {
                  id,
                  payload: { title: '相談', content: '', choices: [] },
                  updated_at: new Date().toISOString(),
                },
              },
              id
            )
          )
        }
      } finally {
        if (!aborted) setLoading(false)
      }
    }
    void run()
    return () => {
      aborted = true
    }
  }, [id])

  return (
    <div className="min-h-screen bg-background">
      {loading ? (
        <div className="p-6 text-sm text-muted-foreground">読み込み中…</div>
      ) : error ? (
        <div className="p-6 text-sm text-destructive">相談の取得に失敗しました：{error}</div>
      ) : data ? (
        <ConsultDetailPanel
          open
          data={data}
          onDecide={async (choiceId) => {
            // 保存（IndexedDB）
            await saveConsultAnswer(id, choiceId)
            // 直ちにUIへ反映
            setData((prev) =>
              prev
                ? { ...prev, selectedChoiceId: choiceId ?? null }
                : prev
            )
            // 保存後に同期を起動（Service Role 環境なら Push→Pull）
            try { await sync(); } catch { }
          }}
        />
      ) : (
        <div className="p-6 text-sm text-muted-foreground">相談が見つかりませんでした。</div>
      )}
    </div>
  )
}
