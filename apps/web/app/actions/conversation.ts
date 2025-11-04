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

import { listLocal } from "@/lib/db-local";
import type { BeliefRecord, TopicThread } from "@repo/shared/types/conversation";

/** GPTに渡す thread 形状（エラーメッセージに出ていた型に合わせる） */
type ThreadForGpt = {
  participants: [string, string];
  status: "ongoing" | "paused" | "done";
  id: string;
  updated_at: string;
  deleted: boolean;
  topic?: string;
  lastEventId?: string;
};

/** ラン引数 */
export type RunConversationArgs = {
  /** 既存スレッドID（無ければ undefined） */
  threadId?: string;
  /** 参加者 [A,B] */
  participants: [string, string];
  /** GPTへのヒント（任意） */
  topicHint?: string;
  /** 最終要約（任意。なければ thread 側にない前提で undefined） */
  lastSummary?: string;
};

/** ラン結果 */
export type RunConversationResult = {
  eventId: string;
  threadId: string;
  gptOut: GptConversationOutput;
  evalResult: EvaluationResult;
};

/** beliefs を Record<residentId, BeliefRecord> でロード */
async function loadBeliefsDict(): Promise<Record<string, BeliefRecord>> {
  const arr = (await listLocal("beliefs")) as unknown as BeliefRecord[];
  const dict: Record<string, BeliefRecord> = {};
  for (const rec of arr) dict[rec.residentId] = rec;
  return dict;
}

/** threadId と participants から GPT向けの thread オブジェクトを構築 */
async function ensureThreadForGpt(input: {
  threadId?: string;
  participants: [string, string];
}): Promise<ThreadForGpt> {
  const now = new Date().toISOString();

  if (input.threadId) {
    // 既存スレッドを探す
    const allThreads = (await listLocal("topic_threads")) as unknown as TopicThread[];
    const found = allThreads.find((t) => t.id === input.threadId);
    if (found) {
      const t = found;
      // TopicThread -> ThreadForGpt へプロジェクション（status フィールド名に注意）
      const status: "ongoing" | "paused" | "done" = (t.status ?? "ongoing") as any;
      return {
        id: t.id,
        participants: (t.participants as [string, string]) ?? input.participants,
        status,
        topic: t.topic,
        lastEventId: t.lastEventId,
        updated_at: t.updated_at ?? now,
        deleted: !!t.deleted,
      };
    }
  }

  // 新規スレッド相当（最低限の形で GPT に渡す）
  return {
    id: input.threadId ?? "TEMP", // GPT 側が適切に付与/維持する想定。TEMPでも型整合のため入れておく
    participants: input.participants,
    status: "ongoing",
    updated_at: now,
    deleted: false,
  };
}

export async function runConversation(args: RunConversationArgs): Promise<RunConversationResult> {
  const { participants, threadId, topicHint, lastSummary } = args;

  // 1) 入力下ごしらえ：thread / beliefs を用意
  const thread: ThreadForGpt = await ensureThreadForGpt({ threadId, participants });
  const beliefs: Record<string, BeliefRecord> = await loadBeliefsDict();

  // 2) GPT 生成（★ ここがポイント：threadId ではなく thread/ beliefs を渡す）
  const gptOut: GptConversationOutput = await callGptForConversation({
    thread,
    beliefs,
    topicHint,
    lastSummary,
  });

  // 念のため threadId を GPT の返却値から確定
  const ensuredThreadId = gptOut.threadId;

  // 3) ローカル評価
  const evalInput: EvalInput = {
    threadId: ensuredThreadId,
    participants,
    lines: gptOut.lines,
    meta: gptOut.meta,
    // currentImpression を使う場合はここで読み出して渡す
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
