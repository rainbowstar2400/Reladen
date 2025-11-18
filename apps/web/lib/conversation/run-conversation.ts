// apps/web/lib/conversation/run-conversation.ts
// ------------------------------------------------------------
// 会話エンジンのオーケストレータ。
// 1) GPT生成（callGptForConversation）→ 2) ローカル評価 → 3) 永続化
// ------------------------------------------------------------

import type { GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import type { EvaluationResult, EvalInput } from "@/lib/evaluation/evaluate-conversation";
import { evaluateConversation } from "@/lib/evaluation/evaluate-conversation";
import { persistConversation } from "@/lib/persist/persist-conversation";
import { callGptForConversation } from "@/lib/gpt/call-gpt-for-conversation";
import { newId } from "@/lib/newId";

import { listKV as listAny } from "@/lib/db/kv-server";
import type { BeliefRecord, TopicThread } from "@repo/shared/types/conversation";
import { beliefRowToRecord } from "@/lib/conversation/belief-mapper";
import type { ConversationResidentProfile } from "@repo/shared/gpt/prompts/conversation-prompt";

/** GPTに渡す thread 形状 */
type ThreadForGpt = {
  participants: [string, string];
  status: "ongoing" | "paused" | "done";
  id: string;
  updated_at: string;
  deleted: boolean;
  topic?: string;
  lastEventId?: string;
};

export type RunConversationArgs = {
  /** 既存スレッドID（無ければ undefined） */
  threadId?: string;
  /** 参加者 [A,B] */
  participants: [string, string];
  /** GPTへのヒント（任意） */
  topicHint?: string;
  /** 最終要約（任意） */
  lastSummary?: string;
};

export type RunConversationResult = {
  eventId: string;
  threadId: string;
  gptOut: GptConversationOutput;
  evalResult: EvaluationResult;
};

/** beliefs を Record<residentId, BeliefRecord> でロード */
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

async function loadResidentProfiles(
  participantIds: [string, string],
): Promise<Record<string, ConversationResidentProfile>> {
  const uniqueIds = Array.from(new Set(participantIds));
  if (uniqueIds.length === 0) return {};

  const rows = (await listAny("residents")) as unknown as Array<Record<string, unknown>> | null;
  const dict: Record<string, ConversationResidentProfile> = {};
  if (!Array.isArray(rows)) return dict;

  const idSet = new Set(uniqueIds);
  for (const raw of rows) {
    const id = typeof raw?.id === "string" ? raw.id : undefined;
    if (!id || !idSet.has(id)) continue;

    const ageValue = raw && typeof (raw as any).age === "number"
      ? (raw as any).age
      : Number.isFinite(Number((raw as any)?.age))
        ? Number((raw as any).age)
        : null;

    dict[id] = {
      id,
      name: (raw as any)?.name ?? null,
      mbti: (raw as any)?.mbti ?? null,
      gender: (raw as any)?.gender ?? null,
      age: ageValue,
      occupation: (raw as any)?.occupation ?? null,
      speechPreset: (raw as any)?.speech_preset ?? null,
      firstPerson: (raw as any)?.first_person ?? null,
      traits: (raw as any)?.traits ?? null,
      interests: (raw as any)?.interests ?? null,
    };
  }

  return dict;
}

/** threadId と participants から GPT向けの thread オブジェクトを構築 */
async function ensureThreadForGpt(input: {
  threadId?: string;
  participants: [string, string];
}): Promise<ThreadForGpt> {
  const now = new Date().toISOString();

  if (input.threadId) {
    // allThreads が null の可能性を考慮
    const allThreads = (await listAny("topic_threads")) as unknown as
      | TopicThread[]
      | null;

    // allThreads が配列であることを確認
    if (Array.isArray(allThreads)) {
      const found = allThreads.find((t) => t.id === input.threadId);

      if (found) {
        const t = found;
        const status: "ongoing" | "paused" | "done" = (t.status ??
          "ongoing") as any;
        return {
          id: t.id,
          participants:
            (t.participants as [string, string]) ?? input.participants,
          status,
          topic: t.topic,
          lastEventId: (t as any).lastEventId ?? (t as any).last_event_id,
          updated_at: t.updated_at ?? now,
          deleted: !!t.deleted,
        };
      }
    }
  }

  // 新規スレッド相当（最低限の形）
  return {
    id: input.threadId ?? newId(),
    participants: input.participants,
    status: "ongoing",
    updated_at: now,
    deleted: false,
  };
}

export async function runConversation(
  args: RunConversationArgs,
): Promise<RunConversationResult> {
  const { participants, threadId, topicHint, lastSummary } = args;

  // 1) thread / beliefs を用意
  const thread: ThreadForGpt = await ensureThreadForGpt({
    threadId,
    participants,
  });
  const beliefs: Record<string, BeliefRecord> = await loadBeliefsDict();
  const residents = await loadResidentProfiles(participants);

  // 2) GPT 生成
  // ✅ ここがポイント：`threadId` を渡さない。代わりに `thread` と `beliefs` を渡す。
  const gptOut: GptConversationOutput = await callGptForConversation({
    thread,
    beliefs,
    topicHint,
    lastSummary,
    residents,
  });

  // gptOut 自体が null/undefined の場合、即時エラー
  // (APIエラーやZodパース失敗の可能性があるため)
  if (!gptOut) {
    throw new Error(
      "[runConversation] gptOut is null or undefined. callGptForConversation likely failed.",
    );
  }

  // 念のため threadId を GPT の返却値から確定
  const ensuredThreadId = gptOut.threadId;

  // 3) ローカル評価
  const evalInput: EvalInput = {
    threadId: ensuredThreadId,
    participants,
    lines: gptOut.lines,
    meta: gptOut.meta,
  };
  const evalResult = evaluateConversation(evalInput);

  // 4) 永続化
  const { eventId } = await persistConversation({
    gptOut,
    evalResult,
  });

  return {
    eventId,
    threadId: ensuredThreadId,
    gptOut,
    evalResult,
  };
}
