// apps/web/lib/scheduler/conversation-scheduler.ts
// ------------------------------------------------------------
// 住人同士の会話を “自動発火” させるクライアント側スケジューラ。
// - マルチタブ重複を localStorage ロックで抑止（TTL 付き）
// - ジッター付きインターバルで startConversation() を定期実行
// - 深夜など静穏時間帯はスキップ可能
// ------------------------------------------------------------

import { startConversation } from "@/app/actions/conversation";
import { listLocal } from "@/lib/db-local";
import type { TopicThread } from "@repo/shared/types/conversation";
import { selectConversationCandidates } from "@/lib/conversation/candidates";
import type { Resident } from "@/types";

export type SchedulerOptions = {
  /** 有効/無効（UIからも切替できるようにしておくと便利） */
  enabled?: boolean;
  /** ベース間隔(ms)。実際は ±20% のジッターが乗ります */
  baseIntervalMs?: number;
  /** 例: [0, 6] は 0:00-6:59 を静穏帯としてスキップ */
  quietHours?: [number, number];
  /** “新規会話” 用のデフォルト参加者ペア（スレッドが無いときに使う） */
  defaultParticipants?: [string, string];
};

const DEFAULTS: Required<SchedulerOptions> = {
  enabled: true,
  baseIntervalMs: 90_000, // 会話生成間隔：90秒
  quietHours: [1, 6],     // 01:00-06:59 はスキップ（任意で調整）
  defaultParticipants: ["resident_A", "resident_B"],
};

// --- ロック（localStorage） ---------------------------------------------------
// タブ間での二重発火を避けるための簡易ロック。
// window.localStorage は try/catch 必須（SSG/SSRやSafari InPrivate対策）
const LOCK_KEY = "reladen:conv-scheduler:lock";
const LOCK_TTL_MS = 60_000; // 1分で期限切れ扱い

function nowTs() {
  return Date.now();
}
function readLock(): number | null {
  try {
    const v = localStorage.getItem(LOCK_KEY);
    if (!v) return null;
    const ts = Number(v);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}
function writeLock(ts: number) {
  try {
    localStorage.setItem(LOCK_KEY, String(ts));
  } catch {
    // ignore
  }
}
function clearLock() {
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {
    // ignore
  }
}
function tryAcquireLock(): boolean {
  const ts = readLock();
  const t = nowTs();
  if (ts && t - ts < LOCK_TTL_MS) {
    // まだ有効なロックがある
    return false;
  }
  writeLock(t);
  return true;
}
function refreshLock() {
  writeLock(nowTs());
}

// --- 時間帯判定 --------------------------------------------------------------
function inQuietHours(quiet: [number, number]): boolean {
  const h = new Date().getHours();
  const [from, to] = quiet;
  if (from <= to) {
    return h >= from && h <= to;
  } else {
    // 例: [22, 5] のような翌日跨ぎ
    return h >= from || h <= to;
  }
}

// --- 実行対象の選定（非常に単純な実装：最古更新のスレッドを選ぶ） ---------
async function pickThreadOrDefault(defaultPair: [string, string]): Promise<{
  threadId?: string;
  participants: [string, string];
}> {
  const allThreads = (await listLocal("topic_threads")) as unknown as TopicThread[];
  // 条件：status が "ongoing" のものを優先、updated_at が古いものから順
  const ongoing = allThreads.filter((t) => (t as any).status === "ongoing");
  const sorted = (ongoing.length ? ongoing : allThreads).sort((a, b) => {
    const ta = new Date(a.updated_at ?? 0).getTime();
    const tb = new Date(b.updated_at ?? 0).getTime();
    return ta - tb;
  });
  const first = sorted[0];

  if (first) {
    const ps = (first.participants as [string, string]) ?? defaultPair;
    return { threadId: first.id, participants: ps };
  }
  // スレッドが1つも無ければデフォルトペアで新規会話
  return { participants: defaultPair };
}

// --- 反復タスク --------------------------------------------------------------
function jitter(base: number) {
  const r = 1 + (Math.random() * 0.4 - 0.2); // ±20%
  return Math.max(10_000, Math.floor(base * r));
}

export function startConversationScheduler(opts?: SchedulerOptions) {
  if (typeof window === "undefined") return { stop: () => {} }; // SSRでは何もしない

  const O = { ...DEFAULTS, ...(opts ?? {}) };
  if (!O.enabled) return { stop: () => {} };

  let timer: number | null = null;
  let stopped = false;

  const tick = async () => {
    try {
      // タブ切替などで重複させない（visibility が hidden のときは軽くスキップでもOK）
      if (document.hidden) {
        scheduleNext();
        return;
      }
      if (inQuietHours(O.quietHours)) {
        scheduleNext();
        return;
      }
      if (!tryAcquireLock()) {
        // 他タブが担当中
        scheduleNext();
        return;
      }

      // ロック継続（長時間処理に備えて適当に更新しておく）
      refreshLock();

      // 対象選定 → 会話開始
      const target = await pickThreadOrDefault(O.defaultParticipants);

      // 選定された参加者が活動中か（寝ていないか）確認する
      const allResidents = (await listLocal("residents")) as Resident[];
      const now = new Date();
      // 'candidates.ts' のロジックを使って活動中の住人リストを取得
      const awakeCandidates = selectConversationCandidates(now, allResidents);
      const awakeIds = new Set(awakeCandidates.map(r => r.id));

      const [pA, pB] = target.participants;
      if (!awakeIds.has(pA) || !awakeIds.has(pB)) {
        // 参加者のどちらかが就寝中のため、会話をスキップ
        console.log(`[Scheduler] Skipping conversation: ${pA} or ${pB} is sleeping.`);
        refreshLock(); // スキップも「実行」とみなし、ロックを更新して次のインターバルまで待つ
        scheduleNext();
        return;
      }

      await startConversation({
        threadId: target.threadId,         // 既存スレッドがあれば継続
        participants: target.participants, // 無い場合は新規としてGPT側で適切に生成
        // topicHint/lastSummary は必要なら追加で
      });

      // 成功 → ロック更新
      refreshLock();
    } catch (e) {
      // 失敗時はロックを解放（次回リトライのため）
      clearLock();
      // ログは必要なら console.warn(e)
    } finally {
      scheduleNext();
    }
  };

  const scheduleNext = () => {
    if (stopped) return;
    const ms = jitter(O.baseIntervalMs);
    timer = window.setTimeout(tick, ms);
  };

  // 初回起動
  scheduleNext();

  // visibility 変化時に軽くロックを見直す
  const onVis = () => {
    if (!document.hidden) refreshLock();
  };
  document.addEventListener("visibilitychange", onVis);

  // 停止ハンドラ
  const stop = () => {
    stopped = true;
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    document.removeEventListener("visibilitychange", onVis);
    clearLock();
  };

  return { stop };
}
