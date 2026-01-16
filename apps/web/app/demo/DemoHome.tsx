"use client";

import React, { useEffect, useMemo, useState } from "react";

type Weather = "晴れ" | "曇り" | "雨";
type Quietness = "静か" | "ふつう" | "にぎやか";

type NoticeItem = {
  id: string;
  time: string; // "14:00" など
  lines: Array<{ speaker: string; text: string }>;
};

type ResidentStatus = "活動中" | "就寝中" | "外出中" | "不在";
type Resident = {
  id: string;
  label: string; // A/B/C...
  status: ResidentStatus;
  dot: "green" | "blue" | "gray";
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateTime(dt: Date) {
  const yyyy = dt.getFullYear();
  const mm = pad2(dt.getMonth() + 1);
  const dd = pad2(dt.getDate());
  const hh = pad2(dt.getHours());
  const mi = pad2(dt.getMinutes());
  const ss = pad2(dt.getSeconds());
  return {
    date: `${yyyy}/${mm}/${dd}`,
    time: `${hh}:${mi}:${ss}`,
  };
}

const glassClass =
  "rounded-xl border border-white/30 bg-white/20 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.12)]";

const buttonClass =
  "rounded-lg border border-white/30 bg-white/25 px-3 py-2 text-sm hover:bg-white/35 active:bg-white/40 transition focus:outline-none focus:ring-2 focus:ring-white/40";

const subtleText = "text-white/90";
const dimText = "text-white/70";

export default function DemoHome() {
  // 仮の世界状態
  const [weather] = useState<Weather>("晴れ");
  const [quietness] = useState<Quietness>("静か");

  // 時計（1秒更新）
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // 仮データ（左：通知）
  const notices: NoticeItem[] = useMemo(
    () => [
      {
        id: "n1",
        time: "14:00",
        lines: [
          { speaker: "A", text: "今日はいい天気だね。" },
          { speaker: "B", text: "うん、散歩日和。" },
        ],
      },
      {
        id: "n2",
        time: "13:30",
        lines: [
          { speaker: "C", text: "昨日の本、面白かった。" },
          { speaker: "D", text: "へえ、そうなんだ。" },
        ],
      },
    ],
    []
  );

  // 仮データ（右：住人一覧）
  const [residents] = useState<Resident[]>([
    { id: "rA", label: "A", status: "活動中", dot: "green" },
    { id: "rB", label: "B", status: "活動中", dot: "green" },
    { id: "rC", label: "C", status: "活動中", dot: "green" },
    { id: "rD", label: "D", status: "就寝中", dot: "blue" },
    { id: "rE", label: "E", status: "外出中", dot: "gray" },
  ]);

  // 並べ替え・検索
  const [sortKey, setSortKey] = useState<"label" | "status">("label");
  const [query, setQuery] = useState("");

  const filteredResidents = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = residents.filter((r) => {
      if (!q) return true;
      return (
        r.label.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    });

    const sorted = [...base].sort((a, b) => {
      if (sortKey === "label") return a.label.localeCompare(b.label);
      // status: 活動中 → 外出中 → 就寝中 → 不在（例）
      const order: Record<ResidentStatus, number> = {
        活動中: 0,
        外出中: 1,
        就寝中: 2,
        不在: 3,
      };
      return order[a.status] - order[b.status] || a.label.localeCompare(b.label);
    });

    return sorted;
  }, [residents, query, sortKey]);

  const { date, time } = formatDateTime(now);

  return (
    <main className="min-h-[100svh] w-full">
      {/* 背景（窓の空っぽい雰囲気を、画像なしで近づける） */}
      <div className="relative min-h-[100svh] w-full overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1200px 600px at 60% 20%, rgba(255,255,255,0.18), transparent 60%)," +
              "linear-gradient(180deg, rgba(120,170,220,0.95) 0%, rgba(170,210,235,0.85) 40%, rgba(210,225,235,0.75) 100%)",
          }}
        />
        {/* 床っぽい帯 */}
        <div
          className="absolute inset-x-0 bottom-0 h-[32%]"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(120,90,60,0.12) 25%, rgba(80,55,35,0.18) 100%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6 py-6">
          {/* 上部バー */}
          <div className={`${glassClass} px-5 py-3`}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className={`text-base font-semibold ${subtleText}`}>
                天気：{weather}
              </div>
              <div className={`text-base ${subtleText}`}>
                今は{quietness === "静か" ? "静かなようです。" : quietness === "にぎやか" ? "にぎやかなようです。" : "ふつうのようです。"}
              </div>
            </div>
          </div>

          {/* メイン2カラム */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 左：通知 */}
            <section className={`${glassClass} p-5`}>
              <header className="mb-4 flex items-center gap-3">
                <div
                  className="h-9 w-9 rounded-lg border border-white/30 bg-white/25 flex items-center justify-center"
                  aria-hidden="true"
                >
                  {/* かんたんな封筒アイコン（SVG） */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-white/90"
                  >
                    <path
                      d="M4 6h16v12H4V6Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="m4 7 8 6 8-6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
                <div className={`text-base font-semibold ${subtleText}`}>
                  太郎から相談が届いています。
                </div>
              </header>

              <div className="space-y-3">
                {notices.map((n) => (
                  <article
                    key={n.id}
                    className="rounded-xl border border-white/25 bg-white/15 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        {n.lines.map((line, idx) => (
                          <div key={idx} className={`text-sm ${subtleText}`}>
                            <span className="mr-3 inline-block w-4 font-semibold">
                              {line.speaker}
                            </span>
                            <span>「{line.text}」</span>
                          </div>
                        ))}
                      </div>
                      <div className={`text-sm ${dimText}`}>{n.time}</div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        className={`${buttonClass} px-4`}
                        onClick={() => {
                          // デモ用：実装時は詳細画面へ遷移
                          alert("（デモ）詳細を開く想定です。");
                        }}
                        aria-label="この項目を詳しく見る"
                      >
                        見てみる &gt;
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* 右：みんなの様子 */}
            <section className={`${glassClass} p-5`}>
              <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className={`text-lg font-semibold ${subtleText}`}>
                  みんなの様子
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2">
                    <span className={`text-sm ${dimText}`}>並べ替え</span>
                    <select
                      className="rounded-lg border border-white/30 bg-white/20 px-2 py-2 text-sm text-white/90 focus:outline-none focus:ring-2 focus:ring-white/40"
                      value={sortKey}
                      onChange={(e) =>
                        setSortKey(e.target.value as "label" | "status")
                      }
                      aria-label="並べ替え"
                    >
                      <option value="label">名前（A→Z）</option>
                      <option value="status">状態</option>
                    </select>
                  </label>

                  <label className="relative">
                    <span className="sr-only">検索</span>
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/70">
                      🔍
                    </span>
                    <input
                      className="w-44 rounded-lg border border-white/30 bg-white/20 pl-9 pr-3 py-2 text-sm text-white/90 placeholder:text-white/55 focus:outline-none focus:ring-2 focus:ring-white/40"
                      placeholder="検索"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                </div>
              </header>

              <div className="max-h-[330px] overflow-auto pr-1">
                <ul className="space-y-2">
                  {filteredResidents.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between rounded-xl border border-white/25 bg-white/15 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <StatusDot color={r.dot} />
                        <div className={`text-base font-semibold ${subtleText}`}>
                          {r.label}
                        </div>
                        <div className={`text-sm ${dimText}`}>
                          {r.status}
                        </div>
                      </div>

                      <button
                        type="button"
                        className={buttonClass}
                        onClick={() => {
                          // デモ用：実装時は「覗く」画面（モーダル/遷移）へ
                          alert(`（デモ）${r.label} を覗く想定です。`);
                        }}
                        aria-label={`${r.label} を覗く`}
                      >
                        覗く
                      </button>
                    </li>
                  ))}
                </ul>

                {filteredResidents.length === 0 && (
                  <div className={`mt-4 text-sm ${dimText}`}>
                    該当する住人がいません。
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* 下部ナビ + 時計 */}
          <footer className="mt-10">
            <div className="relative flex items-center justify-between">
              <button
                type="button"
                className="text-white/90 hover:text-white transition underline underline-offset-4"
                onClick={() => alert("（デモ）日報へ遷移する想定です。")}
              >
                ← 日報へ
              </button>

              {/* 中央時計（置物っぽい） */}
              <div className="absolute left-1/2 -translate-x-1/2 -translate-y-4">
                <div
                  className={`${glassClass} px-8 py-4 text-center`}
                  role="group"
                  aria-label="現在時刻"
                >
                  <div className={`text-sm ${dimText}`}>{date}</div>
                  <div className={`text-2xl font-semibold ${subtleText}`}>
                    {time}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="text-white/90 hover:text-white transition underline underline-offset-4"
                onClick={() => alert("（デモ）管理室へ遷移する想定です。")}
              >
                管理室へ →
              </button>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}

function StatusDot({ color }: { color: "green" | "blue" | "gray" }) {
  const cls =
    color === "green"
      ? "bg-emerald-400"
      : color === "blue"
      ? "bg-sky-400"
      : "bg-white/50";
  return (
    <span
      className={`h-3.5 w-3.5 rounded-full border border-white/60 ${cls}`}
      aria-hidden="true"
    />
  );
}
