// apps/web/lib/persist/persist-conversation.ts
import { putLocal, listLocal } from "@/lib/db-local";
import { newId } from "@/lib/newId";
import type { GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import type {
  BeliefRecord,
  NotificationRecord,
  TopicThread,
} from "@repo/shared/types/conversation";
import type { EvaluationResult } from "@/lib/evaluation/evaluate-conversation";
import type { Feeling } from "@/types";


/**
 * SYSTEM行を人間可読で組み立て（UIでそのまま表示可能）
 */
function makeSystemLine(out: GptConversationOutput, r: EvaluationResult): string {
  const [a, b] = out.participants;
  const fmt = (x: number) => (x > 0 ? `+${x}` : `${x}`);
  const impArrow = (x: number) => (x > 0 ? "↑" : x < 0 ? "↓" : "→");
  return `SYSTEM: ${a}→${b} 好感度 ${fmt(r.deltas.aToB.favor)} / 印象 ${impArrow(r.deltas.aToB.impression)} | ${b}→${a} 好感度 ${fmt(r.deltas.bToA.favor)} / 印象 ${impArrow(r.deltas.bToA.impression)}`;
}

/**
 * relations / feelings を簡易更新
 * - ここではシンプルに “イベント毎の差分を積み上げる” 方針。
 * - 実プロジェクトの正規ロジックが別にあれば差し替えてOK。
 */
async function updateRelationsAndFeelings(params: {
  participants: [string, string];
  deltas: EvaluationResult["deltas"];
}) {
  const [a, b] = params.participants;
  const now = new Date().toISOString();

  // listLocal は Entity[]（Union）を返すため、Feeling[] に明示キャストして扱う
  const feelings = (await listLocal("feelings")) as unknown as Feeling[];

  // 既存レコード検索（a->b / b->a）
  const findFeeling = (fromId: string, toId: string) =>
    feelings.find((f) => (f as any).a_id === fromId && (f as any).b_id === toId);

  const recAB = findFeeling(a, b);
  const recBA = findFeeling(b, a);

  const idAB = recAB?.id ?? newId();
  const idBA = recBA?.id ?? newId();

  const curFavorAB = (recAB as any)?.favor ?? 0;
  const curFavorBA = (recBA as any)?.favor ?? 0;

  // a -> b
  await putLocal("feelings", {
    id: idAB,
    a_id: a,
    b_id: b,
    // ここでは “数値を積み上げる” 簡易実装。プロジェクト本番ロジックが別にあれば差し替え可
    favor: curFavorAB + params.deltas.aToB.favor,
    updated_at: now,
    deleted: false,
  } as any);

  // b -> a
  await putLocal("feelings", {
    id: idBA,
    a_id: b,
    b_id: a,
    favor: curFavorBA + params.deltas.bToA.favor,
    updated_at: now,
    deleted: false,
  } as any);

  // 印象ラベル（impression）は +1 / -1 の段差を別途管理している想定。
  // ラベルの正規ロジックが決まっていれば、ここで適用してください。
}

/**
 * topic_threads の lastEventId / status を更新
 */
async function updateThreadAfterEvent(params: {
  threadId: string;
  lastEventId: string;
  signal?: "continue" | "close" | "park";
}) {
  const now = new Date().toISOString();
  let status: TopicThread["status"] = "ongoing";
  if (params.signal === "close") status = "done";
  else if (params.signal === "park") status = "paused";

  await putLocal("topic_threads", {
    id: params.threadId,
    lastEventId: params.lastEventId,
    status,
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
  await putLocal("notifications", n);
}

async function updateBeliefs(newBeliefs: Record<string, BeliefRecord>) {
  const now = new Date().toISOString();
  for (const [residentId, rec] of Object.entries(newBeliefs)) {
    await putLocal("beliefs", {
      ...rec,
      residentId,           // 念のため residentId をキーに合わせて上書き
      updated_at: now,
      deleted: false,
    });
  }
}

/**
 * 会話の永続化：events / topic_threads / notifications / beliefs / feelings
 */
export async function persistConversation(params: {
  gptOut: GptConversationOutput;
  evalResult: EvaluationResult;
}) {
  const { gptOut, evalResult } = params;
  const now = new Date().toISOString();

  // 1) events へ保存（systemLine を確定）
  const eventId = newId();
  const systemLine = makeSystemLine(gptOut, evalResult);

  await putLocal("events", {
    id: eventId,
    kind: "conversation",
    updated_at: now,
    deleted: false,
    payload: {
      ...gptOut,
      deltas: evalResult.deltas,
      systemLine,
    },
  } as any);

  // 2) topic_threads の lastEventId / status を更新
  const signal = gptOut.meta.signals?.[0];
  await updateThreadAfterEvent({
    threadId: gptOut.threadId,
    lastEventId: eventId,
    signal,
  });

  // 3) beliefs を更新（冪等）
  await updateBeliefs(evalResult.newBeliefs);

  // 4) relations / feelings を更新（簡易版）
  await updateRelationsAndFeelings({
    participants: gptOut.participants,
    deltas: evalResult.deltas,
  });

  // 5) 通知登録
  const first = gptOut.lines[0];
  const snippet = first ? `${first.speaker.slice(0, 4)}: ${first.text.slice(0, 28)}…` : undefined;
  await createNotification({
    linkedEventId: eventId,
    threadId: gptOut.threadId,
    participants: gptOut.participants,
    snippet,
  });

  return { eventId };
}
