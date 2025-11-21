'use client'
import React, { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { listLocal } from '@/lib/db-local';
import type { EventLogStrict } from '@repo/shared/types/conversation';
import { replaceResidentIds, useResidentNameMap } from '@/lib/data/residents';

type ChangeKind = '好感度' | '印象' | '関係' | '信頼度'
type ChangeKindFilter = ChangeKind | ''
type ReportItem = {
  id: string
  at: string // ISO (Asia/Tokyo想定)
  text: string
  /** イベント種別：会話・相談・その他（将来拡張可） */
  category: 'conversation' | 'consult' | 'other'
  chips: { kind: ChangeKind; label: string }[] // 空でもOK
  a?: string; b?: string // キャラ関与（任意）
}

const KINDS: ChangeKind[] = ['好感度', '印象', '関係', '信頼度']

// 変化種別ごとの色（Tailwind）
const CHIP_CLASS: Record<ChangeKind, string> = {
  '好感度': 'bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/60 dark:hover:text-rose-200',
  '印象': 'bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/60 dark:hover:text-sky-200',
  '関係': 'bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/60 dark:hover:text-amber-200',
  '信頼度': 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-200',
}

function fmtDate(d: Date) {
  const f = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
  const p = f.formatToParts(d)
  const get = (t: string) => p.find(x => x.type === t)?.value ?? ''
  return { y: get('year'), m: get('month'), d: get('day'), wd: get('weekday') }
}
function fmtTime(iso: string) {
  const d = new Date(iso)
  const f = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false })
  return f.format(d)
}

function useOpenConsult() {
  const router = useRouter()
  return (id: string) => {
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : ''
    )
    params.set('consult', id)
    router.push(`?${params.toString()}`, { scroll: false })
  }
}

export default function ReportsPage() {
  const router = useRouter()
  const openConsult = useOpenConsult()
  const residentNameMap = useResidentNameMap();

  function openLog(id: string) {
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : ''
    )
    params.set('log', id)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  // ---- フィルタ状態（即時反映） ----
  const today = useMemo(() => {
    const d = new Date()
    const { y, m, d: dd } = fmtDate(d)
    return `${y}-${m}-${dd}` // input[type=date]
  }, [])
  const [date, setDate] = useState(today)
  const [charA, setCharA] = useState<string>('') // 任意
  const [charB, setCharB] = useState<string>('') // 任意
  const [kind, setKind] = useState<ChangeKindFilter>('')
  const resetFilters = () => {
    setDate(today)
    setCharA('')
    setCharB('')
    setKind('')
  }
  // ---- 実データ（会話）をロード → ReportItem[] に変換 ----
  // ---- 実データ（会話＋相談）を events からロード → ReportItem[] に変換 ----
  const [convItems, setConvItems] = useState<ReportItem[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // すべての events を取得（EventLogStrict 形）
        const all = (await listLocal('events')) as unknown as EventLogStrict[];

        // 対象は conversation / consult のみ
        const targets = all.filter(ev => ev && (ev.kind === 'conversation' || ev.kind === 'consult'));

        // ReportItem へ整形（payload のshape差に耐える防御的マッピング）
        const items: ReportItem[] = targets.map((ev) => {
          const occurred =
            (ev as any)?.payload?.occurredAt ??
            (ev as any)?.occurredAt ??
            ev.updated_at ??
            (ev as any)?.created_at ??
            new Date().toISOString();

          const participants = Array.isArray((ev as any)?.payload?.participants)
            ? (ev as any).payload.participants
            : [];

          const a = participants[0] ?? undefined;
          const b = participants[1] ?? undefined;

          const displayA = a ? (residentNameMap[a] ?? a) : '';
          const displayB = b ? (residentNameMap[b] ?? b) : '';

          // chips（あれば）を抽出：favor / impression を前実装に寄せて簡易生成
          const chips: ReportItem['chips'] = [];
          const deltas = (ev as any)?.payload?.deltas ?? (ev as any)?.deltas;
          if (deltas) {
            const aToB = deltas.aToB ?? {};
            const bToA = deltas.bToA ?? {};
            const favorAB = Number(aToB.favor ?? 0);
            const favorBA = Number(bToA.favor ?? 0);
            if (a && b) {
              if (favorAB > 0) chips.push({ kind: '好感度', label: ` ${displayA}→${displayB}：↑` });
              if (favorAB < 0) chips.push({ kind: '好感度', label: ` ${displayA}→${displayB}：↓` });
              if (favorBA > 0) chips.push({ kind: '好感度', label: ` ${displayB}→${displayA}：↑` });
              if (favorBA < 0) chips.push({ kind: '好感度', label: ` ${displayB}→${displayA}：↓` });
            }
            const toLabel = (s: string) =>
              s === 'none' ? '→' :
                s === 'like' ? '好き' :
                  s === 'like?' ? '好きかも' :
                s === 'curious' ? '気になる' :
                  s === 'awkward' ? '気まずい' :
                    s === 'dislike' ? '嫌い' : s;
            if (a && b) {
              if (aToB.impression != null) chips.push({ kind: '印象', label: ` ${displayA}→${displayB}：${toLabel(String(aToB.impression))}` });
              if (bToA.impression != null) chips.push({ kind: '印象', label: ` ${displayB}→${displayA}：${toLabel(String(bToA.impression))}` });
            }
          }

          // 表示テキスト（会話/相談でフォールバック）
          const systemLine = typeof (ev as any)?.payload?.systemLine === 'string'
            ? replaceResidentIds((ev as any).payload.systemLine, residentNameMap)
            : undefined;

          const participantsText =
            systemLine && displayA && displayB
              ? `${displayA} と ${displayB} が話している。`
              : undefined;

          const text =
            participantsText ??
            systemLine ??
            (ev as any)?.payload?.title ??
            (ev.kind === 'consult'
              ? `${displayA ?? ''} から相談を受けた。`.trim()
              : (displayA && displayB) ? `${displayA} と ${displayB} が会話した。` : '出来事が記録されました。');

          const category: ReportItem['category'] =
            ev.kind === 'consult' ? 'consult'
              : ev.kind === 'conversation' ? 'conversation'
                : 'other';

          return {
            id: ev.id,
            at: occurred,
            text,
            category,
            chips,
            a, b,
          };
        });

        // ここでは全件保持（後段で date / フィルタで絞り込み）
        if (alive) setConvItems(items);
      } catch (e) {
        console.error('reports: load events failed', e);
        if (alive) setConvItems([]);
      }
    })();
    return () => { alive = false };
  }, [date, residentNameMap]);

  const ALL: ReportItem[] = useMemo(() => convItems, [convItems]);

  // ---- フィルタ＆ソート ----
  const filtered = useMemo(() => {
    const items = ALL
      .filter(it => it.at.startsWith(date))
      .filter(it => (charA ? (it.a === charA || it.b === charA) : true))
      .filter(it => (charB ? (it.a === charB || it.b === charB) : true))
      .filter(it => (kind === '' ? true : it.chips?.some(chip => chip.kind === kind)))
      .sort((a, b) => (a.at < b.at ? 1 : -1)) // 新しい→古い
    return items
  }, [ALL, date, charA, charB, kind])

  // ---- 疑似ローディング（フィルタ変更時）----
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 250)
    return () => clearTimeout(t)
  }, [date, charA, charB, kind])

  // ---- ページネーション ----
  const pageSize = 10
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [date, charA, charB, kind])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const start = (page - 1) * pageSize
  const pageItems = filtered.slice(start, start + pageSize)

  const d = new Date(`${date}T00:00:00+09:00`)
  const { y, m, d: dd, wd } = fmtDate(d)

  // convItems から登場キャラを動的に算出
  const allCharacters = useMemo(() => {
    const s = new Set<string>();
    convItems.forEach((it) => {
      if (it.a) s.add(it.a);
      if (it.b) s.add(it.b);
    });
    return Array.from(s).sort();
  }, [convItems]);

  return (
    <div className="space-y-6">
      {/* フィルタバー */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">日付：</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-md border px-2 py-1 text-sm bg-background" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">キャラクター：</span>
            <select value={charA} onChange={e => setCharA(e.target.value)} className="rounded-md border px-2 py-1 text-sm bg-background">
              <option value="">—</option>
              {allCharacters.map(c => <option key={c} value={c}>{residentNameMap[c] ?? c}</option>)}
            </select>
            <select value={charB} onChange={e => setCharB(e.target.value)} className="rounded-md border px-2 py-1 text-sm bg-background">
              <option value="">—</option>
              {allCharacters.map(c => <option key={c} value={c}>{residentNameMap[c] ?? c}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">変化種別：</span>
            <select value={kind} onChange={e => setKind(e.target.value as ChangeKindFilter)} className="rounded-md border px-2 py-1 text-sm bg-background">
              <option value="">—</option>
              {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-center">
            <Button variant="outline" size="sm" onClick={resetFilters}>
              リセット
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="relative">
        <div className="space-y-6">
          {/* 日付見出し */}
          <div>
            <h2 className="text-2xl font-semibold">{y}/{m}/{dd} <span className="text-muted-foreground text-lg">{wd}</span></h2>
            <div className="mt-2 h-px w-full bg-border" />
          </div>

          {/* リスト（カードは同じ高さ。チップが無い行も高さ確保） */}
          <div className="space-y-4">
            {pageItems.length === 0 && !loading && (
              <p className="py-16 text-center text-sm text-muted-foreground">この条件に一致する記録はありません。</p>
            )}

            {pageItems.map(it => (
              <button
                key={it.id}
                type="button"
                className="w-full text-left"
                onClick={() => {
                  if (it.category === 'consult') {
                    openConsult(it.id)  // ?consult=<id> で相談モーダル
                  } else if (it.category === 'conversation') {
                    openLog(it.id)      // ?log=<id> で会話モーダル（既存）
                  } else {
                    // other：今は何もしない / 将来の拡張（例：systemイベント詳細など）
                  }
                }}
              >
                <div className="flex items-start justify-between rounded-2xl border px-4 py-3 hover:bg-muted/50">
                  <div className="space-y-2">
                    <p>{it.text}</p>
                    <div className="min-h-6 flex flex-wrap gap-2">
                      {it.chips?.map((c, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className={
                            CHIP_CLASS[c.kind] +
                            ' text-[11px] font-medium transition-colors ' +
                            (kind && c.kind === kind ? 'ring-1 ring-current' : '')
                          }
                        >
                          {c.kind}
                          {c.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="ml-4 shrink-0 tabular-nums text-sm text-muted-foreground">
                    {fmtTime(it.at)}
                  </div>
                </div>
              </button>
            ))}

          </div>

          {/* ページネーション */}
          <div className="flex items-center justify-center gap-2 pt-4">
            {page > 1 && (
              <Button variant="outline" size="icon" onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button key={i} variant={page === i + 1 ? 'secondary' : 'outline'} size="icon" onClick={() => setPage(i + 1)}>
                {i + 1}
              </Button>
            ))}
            {page < totalPages && (
              <Button variant="outline" size="icon" onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* ローディングオーバーレイ */}
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-background/60 backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">読み込み中…</p>
          </div>
        )}
      </div>
    </div>
  )
}
