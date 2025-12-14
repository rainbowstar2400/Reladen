"use client";

import React from "react";

type Trace = {
  id: string;
  pair: string;
  timeAgo: string;
  x: string;
  y: string;
  tone: string;
};

const residents = [
  { name: "アリス", status: "家で読書中", mood: "good" },
  { name: "ボブ", status: "外に散歩中", mood: "calm" },
  { name: "カナ", status: "台所で準備中", mood: "busy" },
  { name: "ユウ", status: "作業部屋で集中", mood: "focus" },
  { name: "リン", status: "昼寝中", mood: "rest" },
];

const traces: Trace[] = [
  { id: "t1", pair: "アリス × ボブ", timeAgo: "13分前", x: "12%", y: "18%", tone: "amber" },
  { id: "t2", pair: "カナ × ユウ", timeAgo: "28分前", x: "56%", y: "24%", tone: "teal" },
  { id: "t3", pair: "リン × アリス", timeAgo: "1時間前", x: "34%", y: "58%", tone: "rose" },
  { id: "t4", pair: "ボブ × ユウ", timeAgo: "2時間前", x: "72%", y: "46%", tone: "blue" },
  { id: "t5", pair: "カナ × リン", timeAgo: "3時間前", x: "20%", y: "68%", tone: "violet" },
];

const boardItems = [
  { title: "今日の天気", body: "薄い雨。気温 22° / 湿度 78%", tag: "天気", tone: "teal" },
  { title: "出来事", body: "商人が港に到着。荷下ろし準備中。", tag: "出来事", tone: "amber" },
  { title: "作業予定", body: "広場の掲示板を新調します。", tag: "作業", tone: "violet" },
];

const cssVars: React.CSSProperties = {
  // sand × paper atmosphere
  "--hako-sand": "#f5ede1",
  "--hako-ink": "#2b2620",
  "--hako-muted": "#675f58",
  "--hako-border": "#e5d7c3",
  "--hako-card": "#fffdf8",
  "--hako-card-2": "#f0e7da",
  "--hako-accent": "#c37b34",
  "--hako-accent-2": "#3c7f74",
  "--hako-shadow": "0 12px 40px rgba(63, 44, 25, 0.12)",
  "--hako-soft": "0 10px 30px rgba(0,0,0,0.08)",
} as React.CSSProperties;

function moodChip(mood: string) {
  const map: Record<string, string> = {
    good: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    calm: "bg-sky-500/15 text-sky-700 border-sky-500/30",
    busy: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    focus: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
    rest: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  };
  return map[mood] ?? "bg-stone-500/10 text-stone-700 border-stone-400/30";
}

function toneColor(tone: string) {
  const map: Record<string, string> = {
    amber: "from-amber-300/70 to-amber-500/60 border-amber-500/40",
    teal: "from-teal-300/60 to-teal-500/60 border-teal-500/40",
    rose: "from-rose-300/60 to-rose-500/60 border-rose-500/40",
    blue: "from-sky-300/60 to-sky-500/60 border-sky-500/40",
    violet: "from-violet-300/60 to-violet-500/60 border-violet-500/40",
  };
  return map[tone] ?? "from-stone-200/70 to-stone-400/60 border-stone-400/40";
}

function Card({
  title,
  subtitle,
  children,
  className,
  icon,
  accent,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-3xl border",
        "border-[color:var(--hako-border)] bg-[color:var(--hako-card)]",
        "shadow-[var(--hako-soft)]",
        className ?? "",
      ].join(" ")}
    >
      <div className="absolute inset-0 pointer-events-none opacity-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.45),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.25),transparent_40%)]" />
      </div>
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {icon}
              <div className="text-lg font-semibold tracking-tight text-[color:var(--hako-ink)]">
                {title}
              </div>
            </div>
            {subtitle ? (
              <div className="text-xs text-[color:var(--hako-muted)]">{subtitle}</div>
            ) : null}
          </div>
          {accent ? (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium border border-[color:var(--hako-border)] bg-[color:var(--hako-card-2)]">
              {accent}
            </span>
          ) : null}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function TraceBlob({ trace }: { trace: Trace }) {
  const tone = toneColor(trace.tone);
  return (
    <div
      className="group absolute"
      style={{ left: trace.x, top: trace.y }}
    >
      <div
        className={[
          "w-16 h-16 rounded-[36%] rotate-3 blur-[1px]",
          "bg-gradient-to-br",
          tone,
          "opacity-80 shadow-lg transition duration-500 group-hover:scale-110",
        ].join(" ")}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full bg-white/90 text-[10px] text-center leading-[24px] text-[color:var(--hako-ink)] shadow-sm">
          会
        </div>
      </div>
      <div className="absolute left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition duration-200">
        <div className="rounded-2xl border border-[color:var(--hako-border)] bg-[color:var(--hako-card)] px-3 py-2 text-xs shadow-[var(--hako-soft)]">
          <div className="font-semibold">{trace.pair}</div>
          <div className="text-[color:var(--hako-muted)]">会話の痕跡 / {trace.timeAgo}</div>
        </div>
      </div>
    </div>
  );
}

export default function HakoHomeThemeDemo() {
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ ...cssVars, background: "var(--hako-sand)", color: "var(--hako-ink)" }}
    >
      {/* Background atmosphere */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.7),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.45),transparent_40%)]" />
        <div
          className="absolute inset-0 mix-blend-multiply opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(120deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.2) 100%), repeating-linear-gradient(90deg, rgba(44,32,16,0.04) 0, rgba(44,32,16,0.04) 1px, transparent 1px, transparent 18px)",
            backgroundSize: "100% 100%, 20px 20px",
          }}
        />
      </div>

      <main className="relative mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hako-border)] bg-[color:var(--hako-card)] px-3 py-1 text-xs text-[color:var(--hako-muted)] shadow-sm">
            テーマデモ / 箱庭ホーム
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-2xl font-semibold tracking-tight text-[color:var(--hako-ink)]">
                Reladen 箱庭ホーム（世界観モック）
              </div>
              <div className="text-sm text-[color:var(--hako-muted)]">
                砂丘×紙の質感 / SVGシェイプのみで雰囲気を検証するテストページ
              </div>
            </div>
            <div className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-[color:var(--hako-border)] bg-[color:var(--hako-card-2)] px-3 py-1 text-xs shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[color:var(--hako-accent)] shadow-[0_0_0_6px_rgba(195,123,52,0.18)]" />
              雰囲気ON（色/影/配置を確認）
            </div>
          </div>
        </div>

        <div className="mt-6 grid auto-rows-min gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Card
              title="住人の家エリア"
              subtitle="家アイコン＋名前＋状態。横並びで生活感を出す"
              icon={<IconHouse />}
              accent="みんなの様子"
            >
              <div className="flex flex-wrap gap-3">
                {residents.map((r) => (
                  <div
                    key={r.name}
                    className={[
                      "flex min-w-[200px] flex-1 items-center gap-3 rounded-2xl border px-3 py-3",
                      "border-[color:var(--hako-border)] bg-[color:var(--hako-card-2)] shadow-sm",
                    ].join(" ")}
                  >
                    <div className="relative">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--hako-border)] bg-white shadow-sm">
                        <IconTinyHouse />
                      </div>
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.18)]" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-[color:var(--hako-ink)]">
                        {r.name}
                      </div>
                      <div className="text-xs text-[color:var(--hako-muted)]">{r.status}</div>
                    </div>
                    <div
                      className={[
                        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium",
                        moodChip(r.mood),
                      ].join(" ")}
                    >
                      {r.mood === "good"
                        ? "在宅"
                        : r.mood === "rest"
                        ? "休憩"
                        : r.mood === "busy"
                        ? "準備中"
                        : r.mood === "focus"
                        ? "集中"
                        : "散歩"}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-5">
            <Card
              title="広場（会話の痕跡）"
              subtitle="散らした痕跡。重ならずゆるく配置"
              icon={<IconSparkle />}
              accent="hover で会話概要"
            >
              <div className="relative h-64 overflow-hidden rounded-3xl border border-[color:var(--hako-border)] bg-[color:var(--hako-card-2)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.6),transparent_45%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,0.35),transparent_50%)]" />
                <div className="absolute inset-4 rounded-[28px] border border-dashed border-[color:var(--hako-border)]/80" />
                {traces.map((t) => (
                  <TraceBlob key={t.id} trace={t} />
                ))}
                <div className="absolute left-3 bottom-3 rounded-full bg-white/80 px-3 py-1 text-[11px] text-[color:var(--hako-muted)] shadow">
                  クリックで該当日報へジャンプ（デモ）
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-4">
            <Card
              title="掲示板"
              subtitle="天気・出来事・予定。クリックで詳細"
              icon={<IconBoard />}
            >
              <div className="space-y-3">
                {boardItems.map((b) => (
                  <button
                    key={b.title}
                    type="button"
                    className="w-full text-left"
                    onClick={() => alert("デモ：詳細ページへの導線")}
                  >
                    <div className="rounded-2xl border border-[color:var(--hako-border)] bg-[color:var(--hako-card-2)] px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-[var(--hako-shadow)]">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: b.tone === "teal" ? "#14b8a6" : b.tone === "amber" ? "#f59e0b" : "#8b5cf6" }}
                        />
                        <div className="text-sm font-semibold text-[color:var(--hako-ink)]">
                          {b.title}
                        </div>
                        <span className="ml-auto rounded-full border border-[color:var(--hako-border)] bg-white/70 px-2 py-0.5 text-[10px] text-[color:var(--hako-muted)]">
                          {b.tag}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--hako-muted)]">{b.body}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card
              title="管理室（プレイヤーの家）"
              subtitle="設定/遊び方はここに収納"
              icon={<IconHomeLantern />}
              accent="管理室へ"
            >
              <div className="space-y-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-2xl border border-[color:var(--hako-border)] bg-[color:var(--hako-card-2)] px-4 py-3 text-sm transition hover:-translate-y-0.5 hover:shadow-[var(--hako-shadow)]"
                  onClick={() => alert("デモ：管理室へ")}
                >
                  <span className="flex items-center gap-2">
                    <IconGear />
                    設定 / 遊び方
                  </span>
                  <span className="text-xs text-[color:var(--hako-muted)]">入室</span>
                </button>
                <div className="rounded-2xl border border-[color:var(--hako-border)] bg-white/80 px-4 py-3 text-xs text-[color:var(--hako-muted)]">
                  住民謄本メタファーは後工程。ここでは入口の位置だけ確認。
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card
              title="郵便受け"
              subtitle="未処理相談があるときだけ強調"
              icon={<IconMail />}
              accent="未処理 2"
            >
              <div className="relative rounded-3xl border border-[color:var(--hako-border)] bg-gradient-to-br from-white/90 to-[color:var(--hako-card-2)] px-4 py-5 shadow-[var(--hako-soft)]">
                <div className="absolute -right-2 -top-2 rounded-full bg-rose-500 px-3 py-1 text-[11px] font-semibold text-white shadow-lg">
                  2
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--hako-border)] bg-white shadow-sm">
                    <IconEnvelope />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[color:var(--hako-ink)]">
                      相談の手紙が届いています
                    </div>
                    <div className="text-xs text-[color:var(--hako-muted)]">
                      クリックで「訪問（相談UI）」の仮画面へ
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-3 w-full rounded-2xl bg-[color:var(--hako-accent)]/90 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-[var(--hako-shadow)]"
                  onClick={() => alert("デモ：相談対応UIへ")}
                >
                  訪問する
                </button>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-5">
            <Card
              title="日報（冊子＋羽ペン）"
              subtitle="画面端に常設の入口"
              icon={<IconBook />}
              accent="日報へ"
            >
              <div className="flex flex-col gap-3 rounded-3xl border border-[color:var(--hako-border)] bg-[color:var(--hako-card-2)] p-4 shadow-[var(--hako-soft)] lg:flex-row lg:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--hako-border)] bg-white shadow-sm">
                    <IconFeather />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[color:var(--hako-ink)]">
                      日付一覧 → 会話全文へ
                    </div>
                    <div className="text-xs text-[color:var(--hako-muted)]">
                      既存の日報UIへ接続する導線だけ確認
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full rounded-2xl border border-[color:var(--hako-border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--hako-ink)] transition hover:-translate-y-0.5 hover:shadow-[var(--hako-shadow)] lg:w-auto"
                  onClick={() => alert("デモ：日報画面へ")}
                >
                  日報を開く
                </button>
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-[color:var(--hako-border)] bg-white/80 px-4 py-3 text-xs text-[color:var(--hako-muted)] shadow-sm">
          レスポンシブ：幅が狭い場合はカードが縦並びになります。広い画面ではオブジェクトを散らした配置で「箱庭」感を維持。
        </div>
      </main>
    </div>
  );
}

function IconHouse() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="text-[color:var(--hako-ink)]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1v-8.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTinyHouse() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" className="text-[color:var(--hako-ink)]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 11 12 5l7 6v7a1 1 0 0 1-1 1h-4v-4H10v4H6a1 1 0 0 1-1-1v-7Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSparkle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="text-[color:var(--hako-ink)]" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="m12 2 1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m6 14 .8 2.2L9 18l-2.2.8L6 21l-.8-2.2L3 18l2.2-.8L6 14Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m18 14 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 14Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBoard() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="text-[color:var(--hako-ink)]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9h8M8 12h5M8 15h6" strokeLinecap="round" />
      <path d="m12 5-.8-2M12 5l.8-2" strokeLinecap="round" />
    </svg>
  );
}

function IconHomeLantern() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="text-[color:var(--hako-ink)]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 7h8l1 2.5V17a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V9.5L8 7Z" />
      <path d="M10 2h4M12 2v3" strokeLinecap="round" />
      <path d="M10 11h4" strokeLinecap="round" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-[color:var(--hako-ink)]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="m15.4 4.6-1-.3a2 2 0 0 0-1.8.5l-.9.9-1.2-.2a2 2 0 0 0-2 1l-.5.9-1 .4a2 2 0 0 0-1.2 1.6l-.2 1.1-1 .8a2 2 0 0 0-.3 2.1l.5 1a2 2 0 0 0 1.8 1l1.1-.1.8.9a2 2 0 0 0 1.9.6l1-.3 1 .3a2 2 0 0 0 1.9-.6l.8-.9 1 .1a2 2 0 0 0 1.8-1l.5-1a2 2 0 0 0-.3-2.1l-1-.8-.2-1.1a2 2 0 0 0-1.2-1.6l-1-.4-.5-.9a2 2 0 0 0-2-1l-1.2.2-.9-.9a2 2 0 0 0-1.8-.5l-1 .3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.2" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="text-[color:var(--hako-ink)]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 8.5 12 13l8-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEnvelope() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" className="text-[color:var(--hako-ink)]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 8.5 12 13l8-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" className="text-[color:var(--hako-ink)]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6.5 4h9a2.5 2.5 0 0 1 2.5 2.5V20a1 1 0 0 1-1.2.98l-5.8-1.22-5.8 1.22A1 1 0 0 1 4 20V6.5A2.5 2.5 0 0 1 6.5 4Z" />
      <path d="M7 8h7M7 11h5" strokeLinecap="round" />
    </svg>
  );
}

function IconFeather() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" className="text-[color:var(--hako-ink)]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20 4s-4 0-7 3-4 8-4 8" />
      <path d="M14 7 7 14" strokeLinecap="round" />
      <path d="M9 7H4v12h12v-5" />
    </svg>
  );
}
