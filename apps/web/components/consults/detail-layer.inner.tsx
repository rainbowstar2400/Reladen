// apps/web/components/consults/detail-layer.inner.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ConsultDetailPanel, { ConsultDetail } from './consult-detail-panel'
import { loadConsultAnswer, saveConsultAnswer } from '@/lib/client/consult-storage'
import { useQueryClient } from '@tanstack/react-query'

// DB/APIから取得したデータを ConsultDetailPanel の型へ合わせて整形
async function fetchConsultDetailForPanel(id: string): Promise<ConsultDetail> {
  const res = await fetch(`/api/consults/${id}`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch consult ${id} (${res.status})`);
  const json = await res.json();
  const src = json?.consult ?? json ?? {};
  const p = src?.payload ?? src?.data ?? src ?? {};
  const serverAnswer = json?.answer ?? null;

  // createdAt/created_at から date/weekday/time を派生（無ければ空）
  const createdIso = src?.updated_at ?? p?.updated_at ?? p?.occurredAt ?? null;
  let date = '', weekday = '', time = '';
  if (createdIso) {
    const d = new Date(createdIso);
    date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // choices: { id, label } に整形
  const choicesRaw: any[] =
    Array.isArray(p?.choices) ? p.choices : Array.isArray(p?.options) ? p.options : [];
  const choices = Array.isArray(choicesRaw)
    ? choicesRaw.map((c: any, idx: number) => ({
      id: String(c?.id ?? c?.value ?? `c${idx + 1}`),
      label: String(c?.label ?? c?.text ?? c ?? `選択肢 ${idx + 1}`),
    }))
    : [];

  return {
    id: src?.id ?? id,
    title: p?.title ?? p?.subject ?? '(no title)',
    date,
    weekday,
    time,
    prompt: {
      speaker: p?.speaker ?? p?.residentName ?? p?.from ?? 'System',
      text: p?.text ?? p?.content ?? p?.body ?? '',
    },
    choices,
    replyByChoice: p?.replyByChoice ?? p?.replies ?? {},
    reply: p?.reply ?? null,
    systemAfter: p?.systemAfter ?? [],
    selectedChoiceId: serverAnswer?.selectedChoiceId ?? p?.selectedChoiceId ?? null,
  };
}


export default function ConsultDetailLayerInner() {
  const sp = useSearchParams()
  const queryClient = useQueryClient()
  const consultId = sp.get('consult')
  const [detail, setDetail] = useState<ConsultDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!consultId) {
        setDetail(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const serverDetail = await fetchConsultDetailForPanel(consultId);
        const stored = await loadConsultAnswer(serverDetail.id);
        if (!aborted) {
          setDetail({
            ...serverDetail,
            selectedChoiceId: serverDetail.selectedChoiceId ?? stored?.selectedChoiceId ?? null,
          });
        }
      } catch (e: any) {
        if (!aborted) setError(e?.message ?? 'failed to load consult');
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [consultId]);

  if (!consultId) return null;
  if (loading && !detail) return <div className="p-4 text-sm text-muted-foreground">読み込み中…</div>;
  if (error && !detail) return <div className="p-4 text-sm text-red-600">エラー: {error}</div>;

  return (
    <ConsultDetailPanel
      open={!!consultId}
      data={detail}
      answering={answering}
      onDecide={async (choiceId) => {
        if (!consultId) return

        // 1. ローカルに回答を保存（consult_answers テーブル）
        await saveConsultAnswer(consultId, choiceId)
        setDetail((prev) =>
          prev ? { ...prev, selectedChoiceId: choiceId } : prev
        )

        // 2. Answer API を呼び出し — GPT 返答生成 + trustDelta 計算
        setAnswering(true)
        try {
          const res = await fetch(`/api/consults/${consultId}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ selectedChoiceId: choiceId }),
          })
          if (res.ok) {
            const data = await res.json()
            setDetail((prev) =>
              prev
                ? {
                    ...prev,
                    reply: data.reply,
                    systemAfter: [
                      ...(prev.systemAfter ?? []),
                      ...(data.trustDelta > 0
                        ? ['信頼度：↑']
                        : data.trustDelta < 0
                          ? ['信頼度：↓']
                          : []),
                    ],
                  }
                : prev,
            )
            await queryClient.invalidateQueries({ queryKey: ['residents'] })
          }
        } catch {
          // API 失敗時はローカル保存は済んでいるので致命的ではない
        } finally {
          setAnswering(false)
        }

        // 同期リクエスト
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('reladen:request-sync'))
        }
      }}
    />
  )
}
