// apps/web/lib/persist/persist-conversation.ts
import { putKV as putAny, listKV as listAny } from "@/lib/db/kv-server";
import { newId } from "@/lib/newId";
import type { GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import type {
  BeliefRecord,
  NotificationRecord,
  TopicThread,
} from "@repo/shared/types/conversation";
import type { EvaluationResult } from "@/lib/evaluation/evaluate-conversation";
import type { Feeling } from "@/types";
import { beliefRowToRecord, recordToBeliefRow } from "@/lib/conversation/belief-mapper";


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

  // a -> b
  await putAny("feelings", {
    id: idAB,
    from_id: a,
    to_id: b,
    label: recAB?.label ?? "none",
    // 数値を積み上げる簡易実装。プロジェクト本番ロジックが別にあれば差し替えてください。
    score: curScoreAB + params.deltas.aToB.favor,
    updated_at: now,
    deleted: false,
  });

  // b -> a
  await putAny("feelings", {
    id: idBA,
    from_id: b,
    to_id: a,
    label: recBA?.label ?? "none",
    score: curScoreBA + params.deltas.bToA.favor,
    updated_at: now,
    deleted: false,
  });

  // 印象ラベル（impression）は +1 / -1 の段差を別途管理している想定。
  // ラベルの正規ロジックが決まっていれば、ここで適用してください。
}

/**
 * Belief の更新（冪等）
 */
async function updateBeliefs(newBeliefs: Record<string, BeliefRecord>) {
  const now = new Date().toISOString();
  for (const [residentId, rec] of Object.entries(newBeliefs)) {
    await putAny("beliefs", {
      ...recordToBeliefRow({ ...rec, residentId, updated_at: now, deleted: false }),
    });
  }
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
  status?: TopicThread["status"]; // ★ 変更： status も受け取れるように
}) {
  const now = new Date().toISOString();

  let finalStatus: TopicThread["status"] = "ongoing"; // ★ デフォルト

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

  // 3) beliefs を更新（冪等）
  async function loadBeliefsDict(): Promise<Record<string, BeliefRecord>> {
    // arr が null の可能性を考慮
    const arr = (await listAny("beliefs")) as unknown as Array<Record<string, unknown>> | null;
    const dict: Record<string, BeliefRecord> = {};

    if (Array.isArray(arr)) {
      for (const raw of arr) {
        const rec = beliefRowToRecord(raw as any);
        if (rec?.residentId) {
          dict[rec.residentId] = rec;
        }
      }
    }
    return dict;
  }

  // 既存の loadBeliefsDict はそのまま利用
  async function upsertBeliefsFromNewKnowledge(
    items: Array<{ target: string; key: string }>,
    participants: [string, string],
  ) {
    if (!items?.length) return;

    const dict = await loadBeliefsDict();
    const [a, b] = participants;
    const nowIso = new Date().toISOString();

    // 「target = 学習者ID（知識を得た側）」と解釈し、aboutId を相手にする
    const resolveAboutId = (target: string): string => (target === a ? b : a);

    for (const { target, key } of items) {
      if (!target || !key) continue;

      // 1) 学習者（residentId=target）のレコードを取得/生成
      let rec: BeliefRecord | undefined = dict[target];
      if (!rec) {
        rec = {
          id: newId(),
          residentId: target,       // ← 学習者のレコード
          worldFacts: {},           // 使わないなら空でOK
          personKnowledge: {},      // { [aboutId]: { keys: string[], learnedAt: string } }
          updated_at: nowIso,
          deleted: false,
        } as BeliefRecord;
        dict[target] = rec;
      }

      // 2) 相手 aboutId のセクションを確保し、key を追加
      const aboutId = resolveAboutId(target);

      // 既存レコードの personKnowledge が null の場合、初期化する
      if (!rec.personKnowledge) {
        rec.personKnowledge = {};
      }

      if (!rec.personKnowledge[aboutId]) {
        rec.personKnowledge[aboutId] = { keys: [], learnedAt: nowIso };
      }
      const keys = Array.isArray(rec.personKnowledge[aboutId].keys)
        ? (rec.personKnowledge[aboutId].keys as string[])
        : [];

      if (!keys.includes(key)) keys.push(key);
      rec.personKnowledge[aboutId].keys = keys;
      rec.personKnowledge[aboutId].learnedAt = nowIso;
      rec.updated_at = nowIso;

      const FRESH_DAYS = 14;
      function isStale(iso: string): boolean {
        const t = new Date(iso).getTime();
        return Number.isFinite(t) && (Date.now() - t) > FRESH_DAYS * 86400000;
      }

      // 追加例（keys が長い/古い場合に圧縮する）
      if (isStale(rec.personKnowledge[aboutId].learnedAt) && rec.personKnowledge[aboutId].keys.length > 5) {
        rec.personKnowledge[aboutId].keys = rec.personKnowledge[aboutId].keys.slice(-5);
        // ここで "…(省略)" などの要約フラグを別フィールドに立てても良い
      }

      // 3) upsert（冪等）
      await putAny("beliefs", recordToBeliefRow({ ...rec, deleted: false }));
    }
  }

  upsertBeliefsFromNewKnowledge(evalResult.newBeliefs, gptOut.participants);

  // 4) relations / feelings を更新（簡易版）
  await updateRelationsAndFeelings({
    participants: gptOut.participants,
    deltas: evalResult.deltas,
  });

  // 5) 通知登録
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
