// apps/web/lib/conversation/run-conversation.ts
import { callGptForConversation } from "@/lib/gpt/call-gpt-for-conversation";
import { evaluateConversation } from "@/lib/evaluation/evaluate-conversation";
import { persistConversation } from "@/lib/persist/persist-conversation";
import type { TopicThread, BeliefRecord } from "@repo/shared/types/conversation";

/**
 * 1スレッド分の会話を生成→評価→保存するワンショット関数
 */
export async function runConversation(params: {
  thread: TopicThread;
  beliefs: Record<string, BeliefRecord>;
  topicHint?: string;
  lastSummary?: string;
}) {
  // 1) 生成
  const out = await callGptForConversation({
    thread: params.thread,
    beliefs: params.beliefs,
    topicHint: params.topicHint,
    lastSummary: params.lastSummary,
  });

  // 2) 評価
  const evalResult = evaluateConversation({
    gptOut: out,
    beliefs: params.beliefs,
  });

  // 3) 永続化
  const { eventId } = await persistConversation({
    gptOut: out,
    evalResult,
  });

  return { eventId, out, evalResult };
}
