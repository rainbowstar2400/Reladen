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

  // 削除: const impArrow = (x: number) => (x > 0 ? "↑" : x < 0 ? "↓" : "→");

  // 修正: impArrow() によるラップを外し、impression の値 (string) を直接使用
  return `SYSTEM: ${a}→${b} 好感度 ${fmt(r.deltas.aToB.favor)} / 印象 ${r.deltas.aToB.impression} | ${b}→${a} 好感度 ${fmt(r.deltas.bToA.favor)} / 印象 ${r.deltas.bToA.impression}`;
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
 * Belief の更新（冪等）
 */
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
 * topic_threads の lastEventId / status を更新
 */
async function updateThreadAfterEvent(params: {
  threadId: string;
  lastEventId: string;
  signal?: "continue" | "close" | "park";
  status?: TopicThread["status"]; // ★ 変更： status も受け取れるように
}) {
  const now = new Date().toISOString();

  let finalStatus: TopicThread["status"] = "ongoing"; // ★ デフォルト

  if (params.status) {
    // ★ 1. status (評価側) があれば最優先
    finalStatus = params.status;
  } else if (params.signal === "close") {
    // ★ 2. signal (GPT側)
    finalStatus = "done";
  } else if (params.signal === "park") {
    // ★ 2. signal (GPT側)
    finalStatus = "paused";
  }
  // (signal が 'continue' または undefined の場合は 'ongoing' のまま)

  await putLocal("topic_threads", {
    id: params.threadId,
    lastEventId: params.lastEventId,
    status: finalStatus, // ★ 変更
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

/**
 * 会話の永続化：events / topic_threads / notifications / beliefs / feelings
 */
export async function persistConversation(params: {
  gptOut: GptConversationOutput;
  evalResult: EvaluationResult;
}) {
  const { gptOut, evalResult } = params;
  const now = new Date().toISOString();

  // 1) events へ保存
  const eventId = newId();
  // const systemLine = makeSystemLine(gptOut, evalResult); ← 削除

  await putLocal("events", {
    id: eventId,
    kind: "conversation",
    updated_at: now,
    deleted: false,
    payload: {
      ...gptOut,
      deltas: evalResult.deltas,      // impression はラベル型でOK（数値ではない）
      systemLine: evalResult.systemLine, // ★ ここを評価側のsystemLineに
    },
  } as any);


  // 2) topic_threads の更新
  // const next = evalResult.threadNextState ?? gptOut.meta.signals?.[0]; // ← 型が混在するため削除
  await updateThreadAfterEvent({
    threadId: gptOut.threadId,
    lastEventId: eventId,
    signal: gptOut.meta.signals?.[0],    // ★ GPT側の Signal
    status: evalResult.threadNextState, // ★ 評価側の Status (こちらが優先される)
  });

  // 3) beliefs を更新（冪等）
  async function loadBeliefsDict(): Promise<Record<string, BeliefRecord>> {
    const arr = (await listLocal("beliefs")) as unknown as BeliefRecord[];
    const dict: Record<string, BeliefRecord> = {};
    for (const rec of arr) dict[rec.residentId] = rec;
    return dict;
  }
  async function upsertBeliefsFromNewKnowledge(items: Array<{ target: string; key: string }>) {
    if (!items?.length) return;

    const dict = await loadBeliefsDict();
    const touched: BeliefRecord[] = [];
    const now = new Date().toISOString();

    for (const { target, key } of items) {
      const rec = dict[target];
      if (!rec) continue;

      if (!rec.personKnowledge[target]) {
        rec.personKnowledge[target] = { keys: [], learnedAt: now };
      }
      const ks = rec.personKnowledge[target].keys;
      if (!ks.includes(key)) ks.push(key);
      rec.personKnowledge[target].learnedAt = now;
      rec.updated_at = now;
      touched.push(rec);
    }

    for (const rec of touched) {
      await putLocal("beliefs", {
        ...rec,
        residentId: rec.residentId,
        updated_at: rec.updated_at,
        deleted: false,
      });
    }
  }
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
