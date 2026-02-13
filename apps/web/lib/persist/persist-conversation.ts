// apps/web/lib/persist/persist-conversation.ts
import { putKV as putAny, listKV as listAny } from "@/lib/db/kv-server";
import { newId } from "@/lib/newId";
import type { GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import type {
  NotificationRecord,
  TopicThread,
} from "@repo/shared/types/conversation";
import type { EvaluationResult } from "@/lib/evaluation/evaluate-conversation";
import type { Feeling } from "@/types";


async function updateRelationsAndFeelings(params: {
  participants: [string, string];
  deltas: EvaluationResult["deltas"];
}) {
  const [a, b] = params.participants;
  const now = new Date().toISOString();

  const impressionToFeelingLabel = (
    state: EvaluationResult["deltas"]["aToB"]["impressionState"],
    fallback: Feeling["label"],
  ): Feeling["label"] => {
    const impression = state.special === 'awkward' ? 'awkward' : state.base;
    const map: Record<string, Feeling["label"]> = {
      dislike: "dislike",
      maybe_dislike: "maybe_dislike",
      awkward: "awkward",
      none: "none",
      curious: "curious",
      maybe_like: "maybe_like",
      like: "like",
    };
    return map[String(impression)] ?? fallback ?? "none";
  };

  const clampScore = (value: number) => {
    if (!Number.isFinite(value)) return 0;
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

  const curScoreAB = recAB?.score ?? 0;
  const curScoreBA = recBA?.score ?? 0;

  const nextLabelAB = impressionToFeelingLabel(
    params.deltas.aToB.impressionState,
    recAB?.label ?? "none",
  );
  const nextLabelBA = impressionToFeelingLabel(
    params.deltas.bToA.impressionState,
    recBA?.label ?? "none",
  );

  const nextScoreAB = favorToScore(curScoreAB, params.deltas.aToB.favor);
  const nextScoreBA = favorToScore(curScoreBA, params.deltas.bToA.favor);

  // a -> b
  await putAny("feelings", {
    id: idAB,
    from_id: a,
    to_id: b,
    label: nextLabelAB,
    // 数値を積み上げる簡易実装。プロジェクト本番ロジックが別にあれば差し替えてください。
    score: nextScoreAB,
    updated_at: now,
    deleted: false,
  });

  // b -> a
  await putAny("feelings", {
    id: idBA,
    from_id: b,
    to_id: a,
    label: nextLabelBA,
    score: nextScoreBA,
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
  signal?: "continue" | "close" | "park";
  status?: TopicThread["status"];
}) {
  const now = new Date().toISOString();

  let finalStatus: TopicThread["status"] = "ongoing";

  if (params.status) {
    // 1. status (評価側) があれば最優先
    finalStatus = params.status;
  } else if (params.signal === "close") {
    // 2. signal (GPT側)
    finalStatus = "done";
  } else if (params.signal === "park") {
    // 2. signal (GPT側)
    finalStatus = "paused";
  }
  // (signal が 'continue' または undefined の場合は 'ongoing' のまま)

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

/**
 * 会話の永続化：events / topic_threads / notifications / feelings
 */
export async function persistConversation(params: {
  gptOut: GptConversationOutput;
  evalResult: EvaluationResult;
}) {
  const { gptOut, evalResult } = params;
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
    },
  } as any);


  // 2) topic_threads の更新
  await updateThreadAfterEvent({
    threadId: gptOut.threadId,
    participants: gptOut.participants,
    lastEventId: eventId,
    topic: gptOut.topic,
    // gptOut.meta が null の場合を考慮
    signal: gptOut.meta?.signals?.[0],
    status: evalResult.threadNextState,
  });

  // 3) relations / feelings を更新（簡易版）
  await updateRelationsAndFeelings({
    participants: gptOut.participants,
    deltas: evalResult.deltas,
  });

  // 4) 通知登録
  // gptOut.lines が null の場合を考慮
  const first = Array.isArray(gptOut.lines) ? gptOut.lines[0] : undefined;
  const snippet = first
    ? `${first.speaker.slice(0, 4)}: ${first.text.slice(0, 28)}…`
    : undefined;

  await createNotification({
    linkedEventId: eventId,
    threadId: gptOut.threadId,
    participants: gptOut.participants,
    snippet,
  });

  return { eventId };
}

