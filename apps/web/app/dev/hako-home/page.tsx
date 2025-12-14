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
  { name: "アリス", status: "在宅" },
  { name: "ボブ", status: "散歩" },
  { name: "カナ", status: "準備" },
  { name: "ユウ", status: "集中" },
  { name: "リン", status: "休憩" },
];

const traces: Trace[] = [
  { id: "t1", pair: "アリス × ボブ", timeAgo: "13分前", x: "12%", y: "42%", tone: "amber" },
  { id: "t2", pair: "カナ × ユウ", timeAgo: "28分前", x: "56%", y: "40%", tone: "teal" },
  { id: "t3", pair: "リン × アリス", timeAgo: "1時間前", x: "34%", y: "58%", tone: "rose" },
  { id: "t4", pair: "ボブ × ユウ", timeAgo: "2時間前", x: "72%", y: "52%", tone: "blue" },
  { id: "t5", pair: "カナ × リン", timeAgo: "3時間前", x: "20%", y: "68%", tone: "violet" },
];

const boardItems = [
  { title: "今日の天気", body: "薄い雨。気温 22° / 湿度 78%", tag: "天気", tone: "teal" },
  { title: "出来事", body: "商人が港に到着。荷下ろし準備中。", tag: "出来事", tone: "amber" },
  { title: "作業予定", body: "広場の掲示板を新調します。", tag: "作業", tone: "violet" },
];

const cssVars: React.CSSProperties = {
  "--hako-sand": "#f5ede1",
  "--hako-ink": "#2b2620",
  "--hako-muted": "#675f58",
  "--hako-border": "#e5d7c3",
  "--hako-card": "#fffdf8",
  "--hako-card-2": "#f0e7da",
  "--hako-accent": "#c37b34",
} as React.CSSProperties;

function toneColor(tone: string) {
  const map: Record<string, string> = {
    amber: "from-amber-300/70 to-amber-500/60",
    teal: "from-teal-300/60 to-teal-500/60",
    rose: "from-rose-300/60 to-rose-500/60",
    blue: "from-sky-300/60 to-sky-500/60",
    violet: "from-violet-300/60 to-violet-500/60",
  };
  return map[tone] ?? "from-stone-200/70 to-stone-400/60";
}

function TraceBlob({ trace }: { trace: Trace }) {
  const tone = toneColor(trace.tone);
  return (
    <div className="group absolute" style={{ left: trace.x, top: trace.y }}>
      <div
        className={[
          "w-16 h-16 rounded-[36%] rotate-3 blur-[1px]",
          "bg-gradient-to-br",
          tone,
          "opacity-80 shadow-lg transition duration-500 group-hover:scale-110",
        ].join(" ")}
      />
    </div>
  );
}

export default function HakoHomeThemeDemo() {
  const [modal, setModal] = React.useState<null | { type: "board" | "mail" | "diary" }>(null);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ ...cssVars, background: "var(--hako-sand)", color: "var(--hako-ink)" }}
    >
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
        <header className="flex flex-wrap items-end gap-3">
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
            雰囲気ON
          </div>
        </header>

        {/* 住人エリア + 広場を縦積み（囲まない） */}
        <div className="mt-10 flex flex-col items-center gap-8">
          <div className="flex flex-wrap items-start justify-center gap-4">
            {residents.map((r) => (
              <div key={r.name} className="flex flex-col items-center gap-2 px-3 py-2 text-center">
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-white shadow-sm ring-1 ring-[color:var(--hako-border)]/80">
                    <IconTinyHouse />
                  </div>
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.18)]" aria-hidden />
                </div>
                <div className="text-sm font-semibold text-[color:var(--hako-ink)]">{r.name}</div>
                <div className="text-[11px] text-[color:var(--hako-muted)]">{r.status}</div>
              </div>
            ))}
          </div>

          <div className="relative h-80 w-full max-w-3xl">
            <div className="absolute inset-0 rounded-[30px] bg-[color:var(--hako-card-2)]/70 shadow-lg backdrop-blur">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.6),transparent_45%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,0.35),transparent_50%)]" />
              {traces.map((t) => (
                <TraceBlob key={t.id} trace={t} />
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* 画面端の散らし配置 */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute right-6 top-6 pointer-events-auto">
          <IconTile icon={<IconBoard />} label="掲示板" size="lg" onClick={() => setModal({ type: "board" })} />
        </div>
        <div className="absolute right-6 bottom-6 pointer-events-auto flex flex-col items-end gap-4">
          <IconTile icon={<IconHomeLantern />} label="管理室" size="lg" onClick={() => alert("デモ：管理室へ移動")} />
          <IconTile icon={<IconMail />} label="郵便受け" badge="2" onClick={() => setModal({ type: "mail" })} />
        </div>
        <div className="absolute left-6 bottom-6 pointer-events-auto">
          <IconTile icon={<IconBook />} label="日報" size="lg" onClick={() => setModal({ type: "diary" })} />
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)}>
        {modal?.type === "board" && (
          <div className="space-y-3">
            <div className="text-lg font-semibold text-[color:var(--hako-ink)]">掲示板</div>
            {boardItems.map((b) => (
              <div key={b.title} className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm ring-1 ring-[color:var(--hako-border)]/70">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.tone === "teal" ? "#14b8a6" : b.tone === "amber" ? "#f59e0b" : "#8b5cf6" }} />
                  <div className="text-sm font-semibold text-[color:var(--hako-ink)]">{b.title}</div>
                  <span className="ml-auto rounded-full border border-[color:var(--hako-border)] bg-white/70 px-2 py-0.5 text-[10px] text-[color:var(--hako-muted)]">
                    {b.tag}
                  </span>
                </div>
                <div className="mt-1 text-xs text-[color:var(--hako-muted)]">{b.body}</div>
              </div>
            ))}
          </div>
        )}

        {modal?.type === "mail" && (
          <div className="space-y-3">
            <div className="text-lg font-semibold text-[color:var(--hako-ink)]">郵便受け</div>
            <div className="rounded-2xl bg-gradient-to-br from-white to-[color:var(--hako-card-2)] px-4 py-4 shadow-lg ring-1 ring-[color:var(--hako-border)]/60">
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--hako-ink)]">
                <IconEnvelope />
                未処理相談: 2件
              </div>
              <div className="mt-2 text-xs text-[color:var(--hako-muted)]">
                クリックで訪問（相談対応UI）へ。ここでは仮モーダルで確認しています。
              </div>
            </div>
          </div>
        )}

        {modal?.type === "diary" && (
          <div className="space-y-3">
            <div className="text-lg font-semibold text-[color:var(--hako-ink)]">日報</div>
            <div className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm ring-1 ring-[color:var(--hako-border)]/70">
              <div className="flex items-center gap-2">
                <IconFeather />
                日付一覧 → 会話全文へ
              </div>
              <div className="mt-2 text-xs text-[color:var(--hako-muted)]">
                既存日報画面への導線だけを示す仮モーダルです。
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function IconTile({
  icon,
  label,
  badge,
  size = "md",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  size?: "md" | "lg";
  onClick: () => void;
}) {
  const iconBox = size === "lg" ? "h-14 w-14" : "h-12 w-12";
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center gap-2 px-2 py-2 text-sm font-semibold text-[color:var(--hako-ink)] transition hover:-translate-y-0.5 hover:scale-[1.02]"
    >
      {badge ? (
        <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          {badge}
        </span>
      ) : null}
      <div className={`flex items-center justify-center rounded-2xl text-[color:var(--hako-ink)] ${iconBox}`}>
        {icon}
      </div>
      <div>{label}</div>
    </button>
  );
}

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl bg-[color:var(--hako-card)] p-5 shadow-2xl ring-1 ring-[color:var(--hako-border)]/70">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-[color:var(--hako-muted)] hover:text-[color:var(--hako-ink)]"
        >
          ×
        </button>
        {children}
      </div>
    </div>
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
