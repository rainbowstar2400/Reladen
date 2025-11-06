// apps/web/components/consults/detail-layer.inner.tsx
'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import ConsultDetailPanel, { ConsultDetail } from './consult-detail-panel'
import { loadConsultAnswer, saveConsultAnswer } from '@/lib/client/consult-storage'

// DB/APIから取得したデータを ConsultDetailPanel の型へ合わせて整形
async function fetchConsultDetailForPanel(id: string): Promise<Omit<ConsultDetail, 'selectedChoiceId'>> {
  const res = await fetch(`/api/consults/${id}`, { method: 'GET', headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch consult ${id} (${res.status})`);
  const json = await res.json();

  // createdAt/created_at から date/weekday/time を派生（無ければ空）
  const createdIso = json?.createdAt ?? json?.created_at ?? null;
  let date = '', weekday = '', time = '';
  if (createdIso) {
    const d = new Date(createdIso);
    date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // choices: { id, label } に整形
  const choices = Array.isArray(json?.choices)
    ? json.choices.map((c: any) => ({ id: String(c?.id ?? ''), label: String(c?.label ?? c?.text ?? '') }))
    : [];

  return {
    id: json?.id ?? id,
    title: json?.title ?? '(no title)',
    date,
    weekday,
    time,
    prompt: {
      speaker: json?.prompt?.speaker ?? json?.speaker ?? 'System',
      text: json?.prompt?.text ?? json?.body ?? '',
    },
    choices,
    replyByChoice: json?.replyByChoice ?? {},
    systemAfter: json?.systemAfter ?? [],
    // selectedChoiceId は下の state から合成する
  };
}


export default function ConsultDetailLayerInner() {
  const sp = useSearchParams()
  const consultId = sp.get('consult')
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Omit<ConsultDetail, 'selectedChoiceId'> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const d = await fetchConsultDetailForPanel(consultId);
        if (!aborted) setDetail(d);
      } catch (e: any) {
        if (!aborted) setError(e?.message ?? 'failed to load consult');
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [consultId]);

  const data = useMemo(
    () => (detail ? { ...detail, selectedChoiceId } : null),
    [detail, selectedChoiceId]
  );

  if (!consultId) return null;
  if (loading && !data) return <div className="p-4 text-sm text-muted-foreground">読み込み中…</div>;
  if (error && !data) return <div className="p-4 text-sm text-red-600">エラー: {error}</div>;

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
