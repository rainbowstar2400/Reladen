"use client";

/**
 * Reladen Theme Demo
 * ------------------
 * - 目的: 「置くものは変えない」前提で、デザインテーマだけを切り替えて見比べる簡易デモ画面。
 * - 使い方:
 *   1) Next.js (app router) なら、例えば `apps/web/app/dev/theme-demo/page.tsx` に丸ごと貼る
 *   2) ブラウザで `/dev/theme-demo` を開く
 *
 * 注意:
 * - これは UI の“見た目”検討用のスタブです（データ取得や実イベント生成はしません）
 * - Tailwind を想定（既存の Tailwind 設定がある前提）
 */

import React, { useEffect, useMemo, useState } from "react";

type ThemeId =
  | "lab"
  | "archive"
  | "bulletin"
  | "newsroom"
  | "glass"
  | "soft"
  | "sf"
  | "notebook"
  | "dailyroom";

type ThemeTokens = {
  id: ThemeId;
  label: string;
  tagline: string;

  /** CSS変数（色） */
  vars: Record<string, string>;

  /** 見た目トークン（角丸・影・線・タイポ） */
  radius: {
    card: string;
    chip: string;
    panel: string;
  };
  shadow: {
    card: string;
    panel: string;
  };
  border: {
    card: string;
    panel: string;
    divider: string;
  };
  font: {
    ui: string;
    mono?: string;
  };

  /** 装飾（テーマらしさ） */
  ornament?: {
    headerStyle?: "plain" | "tape" | "label" | "rule";
    surface?: "flat" | "paper" | "glass";
  };
};

const THEMES: ThemeTokens[] = [
  {
    id: "lab",
    label: "静かな研究室（観測ダッシュボード）",
    tagline: "淡色・境界線・整った余白。長時間開きっぱなし向け",
    vars: {
      "--bg": "#F7F8FA",
      "--surface": "#FFFFFF",
      "--surface-2": "#F3F4F6",
      "--text": "#111827",
      "--muted": "#6B7280",
      "--border": "#E5E7EB",
      "--accent": "#2563EB",
      "--accent-2": "#16A34A",
      "--danger": "#DC2626",
    },
    radius: { card: "rounded-2xl", chip: "rounded-full", panel: "rounded-2xl" },
    shadow: { card: "shadow-sm", panel: "shadow-lg" },
    border: { card: "border", panel: "border", divider: "border-t" },
    font: { ui: "font-sans", mono: "font-mono" },
    ornament: { headerStyle: "rule", surface: "flat" },
  },
  {
    id: "archive",
    label: "図書館・アーカイブ（記録保管庫）",
    tagline: "紙っぽい面・索引の雰囲気。日報と相性◎",
    vars: {
      "--bg": "#FAF8F3",
      "--surface": "#FFFEFB",
      "--surface-2": "#F6F0E6",
      "--text": "#2B2A27",
      "--muted": "#6A625A",
      "--border": "#E3D9C9",
      "--accent": "#7C3AED",
      "--accent-2": "#A16207",
      "--danger": "#B91C1C",
    },
    radius: { card: "rounded-2xl", chip: "rounded-full", panel: "rounded-2xl" },
    shadow: { card: "shadow-sm", panel: "shadow-xl" },
    border: { card: "border", panel: "border", divider: "border-t" },
    font: { ui: "font-serif", mono: "font-mono" },
    ornament: { headerStyle: "label", surface: "paper" },
  },
  {
    id: "bulletin",
    label: "掲示板・コミュニティボード",
    tagline: "お知らせが映える。付箋/ピンのニュアンス",
    vars: {
      "--bg": "#F6F7FB",
      "--surface": "#FFFFFF",
      "--surface-2": "#F1F5F9",
      "--text": "#0F172A",
      "--muted": "#64748B",
      "--border": "#E2E8F0",
      "--accent": "#0EA5E9",
      "--accent-2": "#F59E0B",
      "--danger": "#EF4444",
    },
    radius: { card: "rounded-3xl", chip: "rounded-full", panel: "rounded-3xl" },
    shadow: { card: "shadow-md", panel: "shadow-2xl" },
    border: { card: "border", panel: "border", divider: "border-t" },
    font: { ui: "font-sans", mono: "font-mono" },
    ornament: { headerStyle: "tape", surface: "paper" },
  },
  {
    id: "newsroom",
    label: "新聞編集部・紙面デザイン",
    tagline: "コラム/罫線/見出しの階層。『今日の新聞』が核",
    vars: {
      "--bg": "#F8FAFC",
      "--surface": "#FFFFFF",
      "--surface-2": "#F1F5F9",
      "--text": "#0B1220",
      "--muted": "#475569",
      "--border": "#CBD5E1",
      "--accent": "#111827",
      "--accent-2": "#0F766E",
      "--danger": "#DC2626",
    },
    radius: { card: "rounded-xl", chip: "rounded-full", panel: "rounded-xl" },
    shadow: { card: "shadow-sm", panel: "shadow-lg" },
    border: { card: "border", panel: "border", divider: "border-t" },
    font: { ui: "font-serif", mono: "font-mono" },
    ornament: { headerStyle: "rule", surface: "flat" },
  },
  {
    id: "glass",
    label: "Glass / Frosted（上品なガラス）",
    tagline: "半透明・軽さ。アプリ感を強める",
    vars: {
      "--bg": "#0B1220",
      "--surface": "rgba(255,255,255,0.08)",
      "--surface-2": "rgba(255,255,255,0.05)",
      "--text": "#F8FAFC",
      "--muted": "rgba(248,250,252,0.70)",
      "--border": "rgba(255,255,255,0.14)",
      "--accent": "#60A5FA",
      "--accent-2": "#34D399",
      "--danger": "#F87171",
    },
    radius: { card: "rounded-3xl", chip: "rounded-full", panel: "rounded-3xl" },
    shadow: { card: "shadow-xl", panel: "shadow-2xl" },
    border: { card: "border", panel: "border", divider: "border-t" },
    font: { ui: "font-sans", mono: "font-mono" },
    ornament: { headerStyle: "plain", surface: "glass" },
  },
  {
    id: "soft",
    label: "ソフトミニマル（やさしいニュートラル）",
    tagline: "丸み・柔らかい影・薄い色。観察をやさしく支える",
    vars: {
      "--bg": "#F6F7FB",
      "--surface": "#FFFFFF",
      "--surface-2": "#F3F4F6",
      "--text": "#111827",
      "--muted": "#6B7280",
      "--border": "#E5E7EB",
      "--accent": "#7C3AED",
      "--accent-2": "#22C55E",
      "--danger": "#EF4444",
    },
    radius: { card: "rounded-3xl", chip: "rounded-full", panel: "rounded-3xl" },
    shadow: { card: "shadow-md", panel: "shadow-xl" },
    border: { card: "border", panel: "border", divider: "border-t" },
    font: { ui: "font-sans", mono: "font-mono" },
    ornament: { headerStyle: "label", surface: "flat" },
  },
  {
    id: "sf",
    label: "サイレントSF観測ステーション（控えめHUD）",
    tagline: "細線・深色・控えめ発光。世界観を足す",
    vars: {
      "--bg": "#050913",
      "--surface": "#0B1020",
      "--surface-2": "#0A1630",
      "--text": "#E6EDF7",
      "--muted": "#9AA7BF",
      "--border": "#1F2A44",
      "--accent": "#22D3EE",
      "--accent-2": "#A78BFA",
      "--danger": "#FB7185",
    },
    radius: { card: "rounded-2xl", chip: "rounded-full", panel: "rounded-2xl" },
    shadow: { card: "shadow-lg", panel: "shadow-2xl" },
    border: { card: "border", panel: "border", divider: "border-t" },
    font: { ui: "font-sans", mono: "font-mono" },
    ornament: { headerStyle: "plain", surface: "flat" },
  },
  {
    id: "notebook",
    label: "ノート・手帳（バレットジャーナル）",
    tagline: "罫線/余白/整頓。日報が“毎日の記録”になる",
    vars: {
      "--bg": "#FBFBF9",
      "--surface": "#FFFFFF",
      "--surface-2": "#F6F6F2",
      "--text": "#1F2937",
      "--muted": "#6B7280",
      "--border": "#E5E7EB",
      "--accent": "#0F766E",
      "--accent-2": "#F59E0B",
      "--danger": "#DC2626",
    },
    radius: { card: "rounded-2xl", chip: "rounded-full", panel: "rounded-2xl" },
    shadow: { card: "shadow-sm", panel: "shadow-lg" },
    border: { card: "border", panel: "border", divider: "border-t" },
    font: { ui: "font-sans", mono: "font-mono" },
    ornament: { headerStyle: "rule", surface: "paper" },
  },
  {
    id: "dailyroom",
    label: "生活の机（薄い日常感）",
    tagline: "“暮らしてる”ニュアンスを薄味で。温度のある観察",
    vars: {
      "--bg": "#F7F4EF",
      "--surface": "#FFFEFC",
      "--surface-2": "#F3EEE6",
      "--text": "#2B2A27",
      "--muted": "#6A625A",
      "--border": "#E3D9C9",
      "--accent": "#0F766E",
      "--accent-2": "#7C3AED",
      "--danger": "#B91C1C",
    },
    radius: { card: "rounded-3xl", chip: "rounded-full", panel: "rounded-3xl" },
    shadow: { card: "shadow-md", panel: "shadow-xl" },
    border: { card: "border", panel: "border", divider: "border-t" },
    font: { ui: "font-serif", mono: "font-mono" },
    ornament: { headerStyle: "tape", surface: "paper" },
  },
];

type PageId = "home" | "daily";

function clsx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function setCssVars(vars: Record<string, string>) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

function Chip({
  children,
  tone = "muted",
  rounded = "rounded-full",
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent" | "good" | "danger";
  rounded?: string;
}) {
  const base =
    "inline-flex items-center gap-2 px-3 py-1 text-xs leading-none border";
  const toneCls =
    tone === "accent"
      ? "text-[color:var(--accent)] border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10"
      : tone === "good"
      ? "text-[color:var(--accent-2)] border-[color:var(--accent-2)]/30 bg-[color:var(--accent-2)]/10"
      : tone === "danger"
      ? "text-[color:var(--danger)] border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10"
      : "text-[color:var(--muted)] border-[color:var(--border)] bg-[color:var(--surface-2)]";
  return <span className={clsx(base, rounded, toneCls)}>{children}</span>;
}

function SectionHeader({
  title,
  subtitle,
  styleMode,
}: {
  title: string;
  subtitle?: string;
  styleMode?: "plain" | "tape" | "label" | "rule";
}) {
  const mode = styleMode ?? "plain";

  if (mode === "tape") {
    return (
      <div className="mb-3">
        <div className="inline-flex items-center gap-2">
          <span className="px-3 py-1 text-sm font-semibold rounded-lg bg-[color:var(--surface-2)] border border-[color:var(--border)]">
            {title}
          </span>
          {subtitle ? (
            <span className="text-xs text-[color:var(--muted)]">{subtitle}</span>
          ) : null}
        </div>
      </div>
    );
  }

  if (mode === "label") {
    return (
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[color:var(--accent)]" />
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        {subtitle ? (
          <span className="text-xs text-[color:var(--muted)]">{subtitle}</span>
        ) : null}
      </div>
    );
  }

  if (mode === "rule") {
    return (
      <div className="mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <div className="h-px flex-1 bg-[color:var(--border)]" />
          {subtitle ? (
            <span className="text-xs text-[color:var(--muted)]">{subtitle}</span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {subtitle ? (
        <span className="text-xs text-[color:var(--muted)]">{subtitle}</span>
      ) : null}
    </div>
  );
}

function Surface({
  children,
  theme,
  className,
}: {
  children: React.ReactNode;
  theme: ThemeTokens;
  className?: string;
}) {
  const glass = theme.ornament?.surface === "glass";
  return (
    <div
      className={clsx(
        theme.radius.card,
        theme.border.card,
        theme.shadow.card,
        "bg-[color:var(--surface)] border-[color:var(--border)]",
        glass && "backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Sidebar({ theme, activePage, setActivePage }: { theme: ThemeTokens; activePage: PageId; setActivePage: (p: PageId) => void }) {
  const navItem = (id: PageId, label: string) => (
    <button
      type="button"
      onClick={() => setActivePage(id)}
      className={clsx(
        "w-full text-left px-3 py-2 rounded-xl transition",
        activePage === id
          ? "bg-[color:var(--surface-2)] border border-[color:var(--border)]"
          : "hover:bg-[color:var(--surface-2)]",
      )}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-[color:var(--muted)]">{id === "home" ? "ホーム" : "日報"}</div>
    </button>
  );

  return (
    <div className="h-full p-3">
      <div className="mb-3">
        <div className="text-lg font-semibold tracking-tight">Reladen</div>
        <div className="text-xs text-[color:var(--muted)]">Theme Demo</div>
      </div>

      <div className="space-y-2">
        {navItem("home", "ホーム")}
        {navItem("daily", "日報")}

        {/* 置くものは変えない前提なので、ここでは2ページに限定（他ページは省略） */}
        <div className="pt-2">
          <div className="text-xs text-[color:var(--muted)]">固定メニュー（参考）</div>
          <div className="mt-2 space-y-2 opacity-70">
            <div className="px-3 py-2 rounded-xl hover:bg-[color:var(--surface-2)]">管理室</div>
            <div className="px-3 py-2 rounded-xl hover:bg-[color:var(--surface-2)]">設定</div>
            <div className="px-3 py-2 rounded-xl hover:bg-[color:var(--surface-2)]">遊び方</div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Chip tone="accent" rounded={theme.radius.chip}>未読 3</Chip>
      </div>
    </div>
  );
}

function HomePage({ theme, onOpenConversation }: { theme: ThemeTokens; onOpenConversation: () => void }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 左 2カラム（お知らせ + みんなの様子） */}
      <div className="lg:col-span-2 space-y-4">
        <Surface theme={theme} className="p-4">
          <SectionHeader
            title="お知らせ"
            subtitle="概要を一覧、クリックで詳細"
            styleMode={theme.ornament?.headerStyle}
          />

          <div className="space-y-3">
            {[
              { title: "EVENT: アリスとボブが会話中…", time: "13:42", unread: true, tags: ["会話", "変化あり"] },
              { title: "SYSTEM: 好感度が変化しました", time: "13:43", unread: true, tags: ["好感度 +1"] },
              { title: "EVENT: 今日は雨です", time: "12:05", unread: false, tags: ["天気"] },
            ].map((n, i) => (
              <button
                key={i}
                type="button"
                onClick={onOpenConversation}
                className={clsx(
                  "w-full text-left p-3 transition",
                  theme.radius.card,
                  "border border-[color:var(--border)]",
                  "hover:bg-[color:var(--surface-2)]",
                  n.unread && "ring-1 ring-[color:var(--accent)]/25",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {n.tags.map((t) => (
                        <Chip key={t} rounded={theme.radius.chip}>{t}</Chip>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-[color:var(--muted)]">{n.time}</div>
                </div>
              </button>
            ))}
          </div>
        </Surface>

        <Surface theme={theme} className="p-4">
          <SectionHeader
            title="みんなの様子"
            subtitle="カードは固定（表示スタイルだけデモ）"
            styleMode={theme.ornament?.headerStyle}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {["アリス", "ボブ", "カナ", "ユウ", "リン"].map((name, i) => (
              <div
                key={i}
                className={clsx(
                  "p-3",
                  theme.radius.card,
                  "border border-[color:var(--border)] bg-[color:var(--surface)]",
                  "hover:bg-[color:var(--surface-2)] transition",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{name}</div>
                    <div className="text-xs text-[color:var(--muted)]">活動中</div>
                  </div>
                  <Chip tone={i % 2 === 0 ? "good" : "accent"} rounded={theme.radius.chip}>
                    {i % 2 === 0 ? "起床" : "外出"}
                  </Chip>
                </div>

                <div className={clsx(theme.border.divider, "mt-3 pt-3 border-[color:var(--border)]")}> 
                  <button
                    type="button"
                    className={clsx(
                      "w-full px-3 py-2 text-sm font-medium transition",
                      theme.radius.card,
                      "bg-[color:var(--accent)] text-white hover:opacity-90",
                    )}
                    // ここは『会話とは別の話しかける処理』の想定。
                    // デモでは動作は持たせず、見た目だけを確認します。
                    onClick={() => alert("（デモ）『話しかける』は未実装の想定")}
                  >
                    話す
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Surface>
      </div>

      {/* 右 1カラム（今日の新聞） */}
      <div className="space-y-4">
        <Surface theme={theme} className="p-4">
          <SectionHeader
            title="今日の新聞"
            subtitle="天気・最終更新"
            styleMode={theme.ornament?.headerStyle}
          />

          <div className="space-y-3">
            <div className={clsx(theme.radius.card, "p-3 bg-[color:var(--surface-2)] border border-[color:var(--border)]")}>
              <div className="text-sm font-semibold">浜松</div>
              <div className="text-xs text-[color:var(--muted)]">最終更新 13:40</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-3xl font-semibold">22°</div>
                <Chip tone="accent" rounded={theme.radius.chip}>雨</Chip>
              </div>
              <div className="mt-2 text-xs text-[color:var(--muted)]">体感は少し肌寒いかもしれません。</div>
            </div>

            <div className="text-xs text-[color:var(--muted)]">
              ※この欄は「新聞（紙面）」のテーマだと罫線・段組っぽく寄せると映えます。
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}

function DailyPage({ theme, onOpenConversation }: { theme: ThemeTokens; onOpenConversation: () => void }) {
  return (
    <div className="space-y-4">
      <Surface theme={theme} className="p-4">
        <SectionHeader
          title="日報"
          subtitle="フィルタ + 一覧（UI見た目のみ）"
          styleMode={theme.ornament?.headerStyle}
        />

        {/* フィルタ（既に実装されている想定：ここでは見た目だけ） */}
        <div className={clsx(theme.radius.card, "p-3 bg-[color:var(--surface-2)] border border-[color:var(--border)]")}> 
          <div className="flex flex-wrap gap-2 items-center">
            <Chip tone="muted" rounded={theme.radius.chip}>日付: 今日</Chip>
            <Chip tone="muted" rounded={theme.radius.chip}>住人: 全員</Chip>
            <Chip tone="muted" rounded={theme.radius.chip}>種別: 全て</Chip>
            <Chip tone="accent" rounded={theme.radius.chip}>リセット</Chip>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {["13:42", "13:43", "13:55", "14:08"].map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={onOpenConversation}
              className={clsx(
                "w-full text-left p-3 transition",
                theme.radius.card,
                "border border-[color:var(--border)] hover:bg-[color:var(--surface-2)]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">EVENT: アリスとボブが会話した。</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Chip tone="good" rounded={theme.radius.chip}>好感度 +1</Chip>
                    <Chip tone="muted" rounded={theme.radius.chip}>印象 変化なし</Chip>
                  </div>
                </div>
                <div className="text-xs text-[color:var(--muted)]">{t}</div>
              </div>
            </button>
          ))}
        </div>
      </Surface>
    </div>
  );
}

function ConversationPanel({ theme, open, onClose }: { theme: ThemeTokens; open: boolean; onClose: () => void }) {
  const glass = theme.ornament?.surface === "glass";

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      {/* backdrop */}
      <div
        className={clsx(
          "absolute inset-0 transition-opacity",
          open ? "opacity-100" : "opacity-0",
          "bg-black/30",
        )}
        onClick={onClose}
      />

      {/* panel */}
      <div
        className={clsx(
          "absolute right-4 top-4 bottom-4 w-[min(520px,calc(100%-2rem))] transition-transform",
          open ? "translate-x-0" : "translate-x-[120%]",
          theme.radius.panel,
          theme.shadow.panel,
          theme.border.panel,
          "border-[color:var(--border)] bg-[color:var(--surface)]",
          glass && "backdrop-blur-md",
        )}
      >
        <div className={clsx("h-full flex flex-col", theme.font.ui)}>
          <div className={clsx("p-4", theme.border.divider, "border-[color:var(--border)]")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-[color:var(--muted)]">会話</div>
                <div className="text-lg font-semibold">アリス × ボブ</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={clsx(
                  "px-3 py-2 text-sm border transition",
                  theme.radius.card,
                  "border-[color:var(--border)] hover:bg-[color:var(--surface-2)]",
                )}
              >
                閉じる
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <Chip tone="muted" rounded={theme.radius.chip}>概要</Chip>
              <Chip tone="accent" rounded={theme.radius.chip}>本文</Chip>
              <Chip tone="muted" rounded={theme.radius.chip}>変化</Chip>
            </div>
          </div>

          {/* messages */}
          <div className="flex-1 overflow-auto p-4 space-y-3">
            <Bubble theme={theme} side="left" name="アリス">
              ねえ、今日の天気、雨っぽいね。
            </Bubble>
            <Bubble theme={theme} side="right" name="ボブ">
              うん。出かけるなら傘いるな。…でも雨音、ちょっと落ち着く。
            </Bubble>
            <Bubble theme={theme} side="left" name="アリス">
              わかる。家でのんびりするのもいいかも。
            </Bubble>

            <div className={clsx(theme.radius.card, "p-3 border border-[color:var(--border)] bg-[color:var(--surface-2)]")}> 
              <div className={clsx("text-xs", theme.font.mono ?? "")}>SYSTEM</div>
              <div className="mt-1 flex flex-wrap gap-2">
                <Chip tone="good" rounded={theme.radius.chip}>アリス → ボブ 好感度 +1</Chip>
                <Chip tone="muted" rounded={theme.radius.chip}>ボブ → アリス 印象 変化なし</Chip>
              </div>
            </div>
          </div>

          {/* footer */}
          <div className={clsx("p-4", theme.border.divider, "border-[color:var(--border)]")}>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className={clsx(
                  "px-3 py-2 text-sm border transition",
                  theme.radius.card,
                  "border-[color:var(--border)] hover:bg-[color:var(--surface-2)]",
                )}
              >
                前の会話
              </button>
              <button
                type="button"
                className={clsx(
                  "px-3 py-2 text-sm border transition",
                  theme.radius.card,
                  "border-[color:var(--border)] hover:bg-[color:var(--surface-2)]",
                )}
              >
                次の会話
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  theme,
  side,
  name,
  children,
}: {
  theme: ThemeTokens;
  side: "left" | "right";
  name: string;
  children: React.ReactNode;
}) {
  const align = side === "left" ? "items-start" : "items-end";
  const bubbleBase =
    "max-w-[78%] px-4 py-3 text-sm border bg-[color:var(--surface)]";
  const bubbleTone =
    side === "left"
      ? "border-[color:var(--border)]"
      : "border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10";
  return (
    <div className={clsx("flex flex-col gap-1", align)}>
      <div className="text-xs text-[color:var(--muted)]">{name}</div>
      <div className={clsx(bubbleBase, theme.radius.card, bubbleTone)}>{children}</div>
    </div>
  );
}

export default function ThemeDemoPage() {
  const [themeId, setThemeId] = useState<ThemeId>("lab");
  const [page, setPage] = useState<PageId>("home");
  const [panelOpen, setPanelOpen] = useState(false);

  const theme = useMemo(() => {
    return THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  }, [themeId]);

  // テーマ切替時に CSS 変数を適用
  useEffect(() => {
    setCssVars(theme.vars);
  }, [theme]);

  return (
    <div className={clsx("min-h-screen", theme.font.ui)} style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* 上部バー */}
      <div className="sticky top-0 z-40">
        <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--surface)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm text-[color:var(--muted)]">テーマ切替デモ</div>
              <div className="text-lg font-semibold">{theme.label}</div>
              <div className="text-xs text-[color:var(--muted)]">{theme.tagline}</div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={themeId}
                onChange={(e) => setThemeId(e.target.value as ThemeId)}
                className={clsx(
                  "px-3 py-2 text-sm border bg-[color:var(--surface)]",
                  theme.radius.card,
                  "border-[color:var(--border)]",
                )}
              >
                {THEMES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className={clsx(
                  "px-3 py-2 text-sm font-medium transition",
                  theme.radius.card,
                  "bg-[color:var(--accent)] text-white hover:opacity-90",
                )}
              >
                会話パネルを開く
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 本体（サイドバー + コンテンツ） */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          <Surface theme={theme} className="overflow-hidden">
            <Sidebar theme={theme} activePage={page} setActivePage={setPage} />
          </Surface>

          <div className="space-y-4">
            {page === "home" ? (
              <HomePage theme={theme} onOpenConversation={() => setPanelOpen(true)} />
            ) : (
              <DailyPage theme={theme} onOpenConversation={() => setPanelOpen(true)} />
            )}
          </div>
        </div>
      </div>

      <ConversationPanel theme={theme} open={panelOpen} onClose={() => setPanelOpen(false)} />

      {/* フッター */}
      <div className="px-4 pb-8">
        <div className="mt-4 text-xs text-[color:var(--muted)]">
          このページは「テーマ比較」専用です。実装に落とす場合は、選んだテーマのトークン（CSS変数）を
          グローバルに適用し、既存コンポーネントへ段階的に反映するのがおすすめです。
        </div>
      </div>
    </div>
  );
}
