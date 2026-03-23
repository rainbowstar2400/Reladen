// apps/web/lib/persist/persist-conversation.ts
import { putKV as putAny, listKV as listAny } from "@/lib/db/kv-server";
import { newId } from "@/lib/newId";
import type { ConversationOutput } from "@repo/shared/types/conversation-generation";
import type {
  NotificationRecord,
  TopicThread,
} from "@repo/shared/types/conversation";
import { DEFAULT_FEELING_SCORE, type Feeling } from "@repo/shared/types";
import type { EvaluationResult } from "@/lib/evaluation/evaluate-conversation";

const FEELING_BASE_LABELS = new Set<Exclude<Feeling["label"], "awkward">>([
  "dislike",
  "maybe_dislike",
  "none",
  "curious",
  "maybe_like",
  "like",
  "love",
]);

type FeelingBaseLabel = Exclude<Feeling["label"], "awkward">;

function normalizeBaseLabel(value: unknown, fallback: FeelingBaseLabel = "none"): FeelingBaseLabel {
  if (typeof value === "string" && FEELING_BASE_LABELS.has(value as FeelingBaseLabel)) {
    return value as FeelingBaseLabel;
  }
  return fallback;
}

function normalizeNullableBaseLabel(value: unknown): FeelingBaseLabel | null {
  if (typeof value !== "string") return null;
  if (!FEELING_BASE_LABELS.has(value as FeelingBaseLabel)) return null;
  return value as FeelingBaseLabel;
}

function toExistingFeelingState(record: Feeling | undefined): {
  baseLabel: FeelingBaseLabel;
  specialLabel: "awkward" | null;
  baseBeforeSpecial: FeelingBaseLabel | null;
} {
  const label = typeof record?.label === "string" ? record.label : "none";
  const baseFromLabel = label === "awkward" ? "none" : normalizeBaseLabel(label);
  const baseLabel = normalizeBaseLabel((record as any)?.base_label, baseFromLabel);
  const specialLabel = (record as any)?.special_label === "awkward" || label === "awkward"
    ? "awkward"
    : null;
  const baseBeforeSpecial = normalizeNullableBaseLabel((record as any)?.base_before_special);
  return {
    baseLabel,
    specialLabel,
    baseBeforeSpecial,
  };
}

function toPersistedFeelingState(params: {
  state: EvaluationResult["deltas"]["aToB"]["impressionState"];
  fallback: {
    baseLabel: FeelingBaseLabel;
    specialLabel: "awkward" | null;
    baseBeforeSpecial: FeelingBaseLabel | null;
  };
}): {
  label: Feeling["label"];
  base_label: FeelingBaseLabel;
  special_label: "awkward" | null;
  base_before_special: FeelingBaseLabel | null;
} {
  const base = normalizeBaseLabel(params.state.base, params.fallback.baseLabel);
  const special = params.state.special === "awkward" ? "awkward" : null;
  const baseBeforeSpecialRaw = special === "awkward"
    ? params.state.baseBeforeSpecial ?? params.fallback.baseBeforeSpecial ?? params.fallback.baseLabel
    : null;
  const baseBeforeSpecial = normalizeNullableBaseLabel(baseBeforeSpecialRaw);
  return {
    label: special === "awkward" ? "awkward" : base,
    base_label: base,
    special_label: special,
    base_before_special: baseBeforeSpecial,
  };
}


async function updateRelationsAndFeelings(params: {
  participants: [string, string];
  deltas: EvaluationResult["deltas"];
  recentDeltas: EvaluationResult["recentDeltas"];
}) {
  const [a, b] = params.participants;
  const now = new Date().toISOString();

  const clampScore = (value: number) => {
    if (!Number.isFinite(value)) return DEFAULT_FEELING_SCORE;
    return Math.max(0, Math.min(100, Math.round(value)));
  };

  // 好感度（favor）のスコアは -2〜+2 程度の小数なので、
  // UI上の 0〜100 スケールに反映されるように係数を掛ける。
  const favorToScore = (current: number, delta: number) => {
    return clampScore(current + Math.round(delta));
  };

  // listAny は null を返す可能性がある
  const feelings = (await listAny("feelings")) as unknown as Feeling[] | null;

  // 既存レコード検索（a->b / b->a）
  const findFeeling = (fromId: string, toId: string) => {
    if (!Array.isArray(feelings)) return undefined;
    return feelings.find((f) => f.from_id === fromId && f.to_id === toId);
  };

  const recAB = findFeeling(a, b);
  const recBA = findFeeling(b, a);

  const idAB = recAB?.id ?? newId();
  const idBA = recBA?.id ?? newId();

  const normalizeCurrentScore = (score: unknown) => {
    if (typeof score !== "number" || !Number.isFinite(score)) {
      return DEFAULT_FEELING_SCORE;
    }
    return score;
  };

  const curScoreAB = normalizeCurrentScore(recAB?.score);
  const curScoreBA = normalizeCurrentScore(recBA?.score);

  const fallbackStateAB = toExistingFeelingState(recAB);
  const fallbackStateBA = toExistingFeelingState(recBA);
  const nextStateAB = toPersistedFeelingState({
    state: params.deltas.aToB.impressionState,
    fallback: fallbackStateAB,
  });
  const nextStateBA = toPersistedFeelingState({
    state: params.deltas.bToA.impressionState,
    fallback: fallbackStateBA,
  });

  const nextScoreAB = favorToScore(curScoreAB, params.deltas.aToB.favor);
  const nextScoreBA = favorToScore(curScoreBA, params.deltas.bToA.favor);

  // a -> b
  await putAny("feelings", {
    id: idAB,
    from_id: a,
    to_id: b,
    label: nextStateAB.label,
    base_label: nextStateAB.base_label,
    special_label: nextStateAB.special_label,
    base_before_special: nextStateAB.base_before_special,
    score: nextScoreAB,
    recent_deltas: params.recentDeltas.aToB,
    last_contacted_at: now,
    updated_at: now,
    deleted: false,
  });

  // b -> a
  await putAny("feelings", {
    id: idBA,
    from_id: b,
    to_id: a,
    label: nextStateBA.label,
    base_label: nextStateBA.base_label,
    special_label: nextStateBA.special_label,
    base_before_special: nextStateBA.base_before_special,
    score: nextScoreBA,
    recent_deltas: params.recentDeltas.bToA,
    last_contacted_at: now,
    updated_at: now,
    deleted: false,
  });

  // 印象ラベルも feelings.label に反映（unknown は既存/none にフォールバック）。
}

/**
 * topic_threads の lastEventId / status を更新
 */
async function updateThreadAfterEvent(params: {
  threadId: string;
  participants: [string, string];
  lastEventId: string;
  topic?: string;
  status?: TopicThread["status"];
}) {
  const now = new Date().toISOString();

  const finalStatus: TopicThread["status"] = params.status ?? "done";

  await putAny("topic_threads", {
    id: params.threadId,
    participants: params.participants,
    topic: params.topic,
    last_event_id: params.lastEventId,
    status: finalStatus,
    updated_at: now,
    deleted: false,
  } as any);
}

/**
 * 通知の登録
 */
async function createNotification(params: {
  linkedEventId: string;
  threadId: string;
  participants: [string, string];
  snippet?: string;
}) {
  const now = new Date().toISOString();
  const n: NotificationRecord = {
    id: newId(),
    type: "conversation",
    linkedEventId: params.linkedEventId,
    threadId: params.threadId,
    participants: params.participants,
    snippet: params.snippet ?? "会話が発生しました。",
    occurredAt: now,
    status: "unread",
    priority: 0,
    updated_at: now,
  };
  await putAny("notifications", {
    id: n.id,
    type: n.type,
    linked_event_id: n.linkedEventId,
    thread_id: n.threadId,
    participants: n.participants,
    snippet: n.snippet,
    occurred_at: n.occurredAt,
    status: n.status,
    priority: n.priority,
    updated_at: n.updated_at,
  });
}

function formatConversationNotificationSnippet(firstLine?: { text?: string }): string {
  const baseText = typeof firstLine?.text === "string" && firstLine.text.length > 0
    ? firstLine.text
    : "会話が発生しました。";
  return `${baseText.slice(0, 20)}…`;
}

/**
 * 会話の永続化：events / topic_threads / notifications / feelings
 */
export async function persistConversation(params: {
  gptOut: ConversationOutput;
  evalResult: EvaluationResult;
  situation?: string;
}) {
  const { gptOut, evalResult, situation } = params;
  const now = new Date().toISOString();

  // 1) events へ保存
  const eventId = newId();

  await putAny("events", {
    id: eventId,
    kind: "conversation",
    updated_at: now,
    deleted: false,
    payload: {
      ...gptOut,
      deltas: evalResult.deltas,      // impression はラベル型でOK（数値ではない）
      systemLine: evalResult.systemLine,
      situation,
    },
  } as any);


  // 2) topic_threads の更新
  await updateThreadAfterEvent({
    threadId: gptOut.threadId,
    participants: gptOut.participants,
    lastEventId: eventId,
    topic: gptOut.topic,
    status: evalResult.threadNextState,
  });

  // 3) relations / feelings を更新
  await updateRelationsAndFeelings({
    participants: gptOut.participants,
    deltas: evalResult.deltas,
    recentDeltas: evalResult.recentDeltas,
  });

  // 4) 通知登録
  // gptOut.lines が null の場合を考慮
  const first = Array.isArray(gptOut.lines) ? gptOut.lines[0] : undefined;
  const snippet = formatConversationNotificationSnippet(first);

  await createNotification({
    linkedEventId: eventId,
    threadId: gptOut.threadId,
    participants: gptOut.participants,
    snippet,
  });

  return { eventId };
}

