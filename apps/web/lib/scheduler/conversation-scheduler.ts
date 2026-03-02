// apps/web/lib/scheduler/conversation-scheduler.ts
// ------------------------------------------------------------
// 住人同士の会話を “自動発火” させるクライアント側スケジューラ。
// - マルチタブ重複を localStorage ロックで抑止（TTL 付き）
// - ジッター付きインターバルで startConversation() を定期実行
// ------------------------------------------------------------

import { listLocal } from "@/lib/db-local";
import type { TopicThread } from "@repo/shared/types/conversation";
import { selectConversationCandidates } from "@/lib/conversation/candidates";
import type { Resident, Relation } from "@/types";

type StartConversationPayload = {
  threadId?: string;
  participants: [string, string];
};

async function callConversationApi(input: StartConversationPayload) {
  const res = await fetch("/api/conversations/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    credentials: "include",
  });

  const rawText = await res.text();
  let data: any = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }
  }

  if (!res.ok) {
    const reason = typeof data === "string" ? data : data?.error ?? "conversation_failed";

    if (res.status === 401) {
      // 認証切れ専用のエラー
      throw new Error('Conversation API error: unauthenticated');
    }

    throw new Error(`Conversation API error: ${reason}`);
  }
}

function hasNoneRelationBetween(
  participants: [string, string],
  relations: Relation[],
) {
  const [a, b] = participants;
  return relations.some((rel) => {
    if (rel.deleted) return false;
    const aId = (rel as any)?.a_id ?? (rel as any)?.aId;
    const bId = (rel as any)?.b_id ?? (rel as any)?.bId;
    if (!aId || !bId) return false;
    const isPair =
      (aId === a && bId === b) ||
      (aId === b && bId === a);
    return isPair && rel.type === "none";
  });
}

function pickAllowedPair(
  awakeCandidates: Resident[],
  relations: Relation[],
): [string, string] | null {
  const shuffled = [...awakeCandidates].sort(() => 0.5 - Math.random());
  for (let i = 0; i < shuffled.length; i += 1) {
    for (let j = i + 1; j < shuffled.length; j += 1) {
      const pair: [string, string] = [shuffled[i].id, shuffled[j].id];
      if (!hasNoneRelationBetween(pair, relations)) {
        return pair;
      }
    }
  }
  return null;
}

export type SchedulerOptions = {
  /** 有効/無効（UIからも切替できるようにしておくと便利） */
  enabled?: boolean;
  /** ベース間隔(ms)。実際は ±20% のジッターが乗ります */
  baseIntervalMs?: number;
  /** “新規会話” 用のデフォルト参加者ペア（スレッドが無いときに使う） */
  defaultParticipants?: [string, string];
};

const DEFAULTS: Required<SchedulerOptions> = {
  enabled: true,
  baseIntervalMs: 900_000, // 会話生成間隔：900秒
  defaultParticipants: ["resident_A", "resident_B"],
};

// --- ロック（localStorage） ---------------------------------------------------
// タブ間での二重発火を避けるための簡易ロック。
// window.localStorage は try/catch 必須（SSG/SSRやSafari InPrivate対策）
const LOCK_KEY = "reladen:conv-scheduler:lock";
const LOCK_TTL_MS = 60_000; // 1分で期限切れ扱い
const LAST_RUN_KEY = "reladen:conv-scheduler:last-run";

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
function readLastRun(): number | null {
  try {
    const v = localStorage.getItem(LAST_RUN_KEY);
    if (!v) return null;
    const ts = Number(v);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}
function writeLastRun(ts: number) {
  try {
    localStorage.setItem(LAST_RUN_KEY, String(ts));
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
function minRunGapMs(baseIntervalMs: number) {
  // 15分ベース時は最短でも約12分間隔を維持（±20%ジッターの下限）
  return Math.max(60_000, Math.floor(baseIntervalMs * 0.8));
}
function hasRecentConversationRun(baseIntervalMs: number): boolean {
  const last = readLastRun();
  if (!last) return false;
  return nowTs() - last < minRunGapMs(baseIntervalMs);
}
function markConversationRun() {
  writeLastRun(nowTs());
}

// --- 実行対象の選定 ---------
async function pickThreadOrDefault(
  /** 現在活動中の住人リスト */
  awakeCandidates: Resident[],
  relations: Relation[],
): Promise<{
  threadId?: string;
  participants: [string, string];
} | null> { // null を返す可能性を追加
  const allThreads = (await listLocal("topic_threads")) as unknown as TopicThread[];
  const usableThreads = allThreads.filter((t) => {
    const ps = (t.participants as [string, string]) ?? [];
    const hasPair = Array.isArray(ps) && ps.length === 2;
    if (!hasPair) return false;
    return !hasNoneRelationBetween(ps, relations);
  });
  // 条件：status が "ongoing" のものを優先、updated_at が古いものから順
  const ongoing = usableThreads.filter((t) => (t as any).status === "ongoing");
  const sorted = (ongoing.length ? ongoing : usableThreads).sort((a, b) => {
    const ta = new Date(a.updated_at ?? 0).getTime();
    const tb = new Date(b.updated_at ?? 0).getTime();
    return ta - tb;
  });
  const first = sorted[0];

  if (first) {
    const ps = first.participants as [string, string];
    // 既存スレッドに参加者が正しく設定されていれば、それを返す
    if (ps && ps.length === 2) {
      return { threadId: first.id, participants: ps };
    }
    // ※ 参加者がいない異常なスレッドは無視し、新規会話ロジックへ
  }

  // スレッドが1つも無いか、スレッドに参加者がいない場合：
  // 活動中の住人から新規ペアを選ぶ
  if (awakeCandidates.length < 2) {
    // 新規会話の候補がいない
    return null;
  }

  // 活動中の住人をシャッフルして先頭2名を選ぶ
  const newPair = pickAllowedPair(awakeCandidates, relations);
  if (!newPair) return null;

  // 新規会話として参加者ペアを返す（threadId はなし）
  return { participants: newPair };
}

// --- 反復タスク --------------------------------------------------------------
function jitter(base: number) {
  const r = 1 + (Math.random() * 0.4 - 0.2); // ±20%
  return Math.max(10_000, Math.floor(base * r));
}

export type TriggerConversationSkipReason =
  | "locked"
  | "recently_ran"
  | "not_enough_awake"
  | "no_target"
  | "relation_none"
  | "participant_sleeping";

export type TriggerConversationNowResult =
  | {
    status: "started";
    threadId?: string;
    participants: [string, string];
  }
  | {
    status: "skipped";
    reason: TriggerConversationSkipReason;
    participants?: [string, string];
  };

export type TriggerConversationNowOptions = {
  baseIntervalMs?: number;
  force?: boolean;
};

export async function triggerConversationNow(
  opts?: TriggerConversationNowOptions,
): Promise<TriggerConversationNowResult> {
  if (typeof window === "undefined") {
    return { status: "skipped", reason: "locked" };
  }

  const baseIntervalMs = opts?.baseIntervalMs ?? DEFAULTS.baseIntervalMs;
  const force = opts?.force === true;

  if (!force && !tryAcquireLock()) {
    return { status: "skipped", reason: "locked" };
  }

  if (!force) {
    refreshLock();
    if (hasRecentConversationRun(baseIntervalMs)) {
      return { status: "skipped", reason: "recently_ran" };
    }
  }

  try {
    const allResidents = (await listLocal("residents")) as Resident[];
    const allRelations = (await listLocal("relations")) as Relation[];
    const activeRelations = allRelations.filter((r) => !r.deleted);
    const now = new Date();
    const awakeCandidates = selectConversationCandidates(now, allResidents);
    const awakeIds = new Set(awakeCandidates.map((r) => r.id));

    if (awakeCandidates.length < 2) {
      return { status: "skipped", reason: "not_enough_awake" };
    }

    const target = await pickThreadOrDefault(awakeCandidates, activeRelations);
    if (!target) {
      return { status: "skipped", reason: "no_target" };
    }

    if (hasNoneRelationBetween(target.participants, activeRelations)) {
      return {
        status: "skipped",
        reason: "relation_none",
        participants: target.participants,
      };
    }

    const [pA, pB] = target.participants;
    if (!awakeIds.has(pA) || !awakeIds.has(pB)) {
      return {
        status: "skipped",
        reason: "participant_sleeping",
        participants: target.participants,
      };
    }

    await callConversationApi({
      threadId: target.threadId,
      participants: target.participants,
    });

    markConversationRun();
    if (!force) refreshLock();
    return {
      status: "started",
      threadId: target.threadId,
      participants: target.participants,
    };
  } catch (error) {
    if (!force) clearLock();
    throw error;
  }
}

export function startConversationScheduler(opts?: SchedulerOptions) {
  if (typeof window === "undefined") return { stop: () => { } }; // SSRでは何もしない

  const O = { ...DEFAULTS, ...(opts ?? {}) };
  if (!O.enabled) return { stop: () => { } };

  let timer: number | null = null;
  let stopped = false;

  const tick = async () => {
    try {
      /* 非アクティブでもタイマーは回す仕様に変更
      // タブ切替などで重複させない
      if (document.hidden) {
        scheduleNext();
        return;
      }
      */
      const result = await triggerConversationNow({ baseIntervalMs: O.baseIntervalMs });
      if (result.status === "started") {
        return;
      }

      switch (result.reason) {
        case "locked":
          return;
        case "recently_ran":
          console.log("[Scheduler] Skipping: conversation ran recently.");
          return;
        case "not_enough_awake":
          console.log(
            "[Scheduler] Skipping: Not enough awake residents to start a conversation.",
          );
          return;
        case "no_target":
          console.log(
            "[Scheduler] Skipping: No target thread or new pair found.",
          );
          return;
        case "relation_none":
          console.log(
            "[Scheduler] Skipping conversation: relation is 'none' between participants.",
          );
          return;
        case "participant_sleeping": {
          const [pA = "participant_A", pB = "participant_B"] = result.participants ?? [];
          console.log(
            `[Scheduler] Skipping conversation: ${pA} or ${pB} is sleeping.`,
          );
          return;
        }
      }
    } catch (e) {
      const msg = (e as any)?.message ?? String(e);
      clearLock();

      if (typeof msg === "string" && msg.includes("unauthenticated")) {
        console.warn(
          "[Scheduler] Disabled: Conversations API returned unauthenticated. Please re-login.",
        );
        stopped = true; // 以後 scheduleNext は何もしないように
        return;
      }

      console.warn("[Scheduler] Failed to run conversation:", e);
    } finally {
      scheduleNext();
    }

  };
  const scheduleNext = () => {
    if (stopped) return;
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    const ms = jitter(O.baseIntervalMs);
    timer = window.setTimeout(() => {
      timer = null;
      void tick();
    }, ms);
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
