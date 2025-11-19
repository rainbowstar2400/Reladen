// apps/web/lib/scheduler/conversation-scheduler.ts
// ------------------------------------------------------------
// 住人同士の会話を “自動発火” させるクライアント側スケジューラ。
// - マルチタブ重複を localStorage ロックで抑止（TTL 付き）
// - ジッター付きインターバルで startConversation() を定期実行
// - 深夜など静穏時間帯はスキップ可能
// ------------------------------------------------------------

import { listLocal } from "@/lib/db-local";
import type { BeliefRecord, TopicThread } from "@repo/shared/types/conversation";
import { selectConversationCandidates } from "@/lib/conversation/candidates";
import type { Resident } from "@/types";
import type { ConversationResidentProfile } from "@repo/shared/gpt/prompts/conversation-prompt";

type StartConversationPayload = {
  threadId?: string;
  participants: [string, string];
  topicHint?: string;
  lastSummary?: string;
  context?: {
    residents?: Record<string, ConversationResidentProfile>;
    beliefs?: Record<string, BeliefRecord>;
  };
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

function toConversationProfile(resident: Resident): ConversationResidentProfile {
  return {
    id: resident.id,
    name: resident.name ?? null,
    mbti: resident.mbti ?? null,
    gender: resident.gender ?? null,
    age: typeof resident.age === "number" ? resident.age : null,
    occupation: resident.occupation ?? null,
    speechPreset: resident.speechPreset ?? null,
    firstPerson: resident.firstPerson ?? null,
    traits: resident.traits ?? null,
    interests: resident.interests ?? null,
  };
}

function buildContextForParticipants(
  participantIds: [string, string],
  residents: Resident[],
  beliefs: BeliefRecord[],
): NonNullable<StartConversationPayload["context"]> {
  const residentMap = new Map(residents.map((r) => [r.id, r]));
  const beliefMap = new Map(beliefs.map((b) => [b.residentId, b]));

  const context: NonNullable<StartConversationPayload["context"]> = {};

  for (const id of participantIds) {
    const res = residentMap.get(id);
    if (res) {
      context.residents = context.residents ?? {};
      context.residents[id] = toConversationProfile(res);
    }
    const belief = beliefMap.get(id);
    if (belief) {
      context.beliefs = context.beliefs ?? {};
      context.beliefs[id] = belief;
    }
  }

  return context;
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

// --- 実行対象の選定 ---------
async function pickThreadOrDefault(
  /** 現在活動中の住人リスト */
  awakeCandidates: Resident[],
): Promise<{
  threadId?: string;
  participants: [string, string];
} | null> { // null を返す可能性を追加
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
  const shuffled = [...awakeCandidates].sort(() => 0.5 - Math.random());
  const newPair: [string, string] = [shuffled[0].id, shuffled[1].id];

  // 新規会話として参加者ペアを返す（threadId はなし）
  return { participants: newPair };
}

// --- 反復タスク --------------------------------------------------------------
function jitter(base: number) {
  const r = 1 + (Math.random() * 0.4 - 0.2); // ±20%
  return Math.max(10_000, Math.floor(base * r));
}

export function startConversationScheduler(opts?: SchedulerOptions) {
  if (typeof window === "undefined") return { stop: () => { } }; // SSRでは何もしない

  const O = { ...DEFAULTS, ...(opts ?? {}) };
  if (!O.enabled) return { stop: () => { } };

  let timer: number | null = null;
  let stopped = false;

  const tick = async () => {
    try {
      // タブ切替などで重複させない
      if (document.hidden) {
        scheduleNext();
        return;
      }
      // 他タブが担当中ならスキップ
      if (!tryAcquireLock()) {
        scheduleNext();
        return;
      }

      // ロック継続
      refreshLock();

      // 先に活動中の住人を選定
      const allResidents = (await listLocal("residents")) as Resident[];
      const allBeliefs = (await listLocal("beliefs")) as BeliefRecord[];
      const now = new Date();
      const awakeCandidates = selectConversationCandidates(now, allResidents);
      const awakeIds = new Set(awakeCandidates.map((r) => r.id));

      // 会話可能な住人が2人未満の場合はスキップ
      if (awakeCandidates.length < 2) {
        console.log(
          "[Scheduler] Skipping: Not enough awake residents to start a conversation.",
        );
        refreshLock();
        scheduleNext();
        return;
      }

      // 対象選定（既存スレッド or 新規ペア）
      const target = await pickThreadOrDefault(awakeCandidates);

      // 対象が見つからない場合（通常は発生しない）
      if (!target) {
        console.log(
          "[Scheduler] Skipping: No target thread or new pair found.",
        );
        refreshLock();
        scheduleNext();
        return;
      }

      // 選定された参加者が活動中か最終確認
      // （主に既存スレッドが選ばれたが、その参加者が寝たケース）
      const [pA, pB] = target.participants;
      if (!awakeIds.has(pA) || !awakeIds.has(pB)) {
        // ログメッセージが実際のID（pA, pB）で表示される
        console.log(
          `[Scheduler] Skipping conversation: ${pA} or ${pB} is sleeping.`,
        );
        refreshLock();
        scheduleNext();
        return;
      }

      // 会話開始
      const context = buildContextForParticipants(target.participants, allResidents, allBeliefs);

      await callConversationApi({
        threadId: target.threadId, // 既存スレッドがあれば継続
        participants: target.participants, // 必須
        context: Object.keys(context).length ? context : undefined,
      });

      // 成功 → ロック更新
      refreshLock();
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
