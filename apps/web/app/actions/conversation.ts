// apps/web/app/actions/conversation.ts
"use server";

import { runConversation } from "@/lib/conversation/run-conversation";

export type StartConversationInput = {
  threadId?: string;
  participants: [string, string];
  topicHint?: string;
  lastSummary?: string;
};

export type StartConversationResult = {
  eventId: string;
  threadId: string;
};

export async function startConversation(
  input: StartConversationInput
): Promise<StartConversationResult> {
  // （必要ならZod等で input を検証）
  const { eventId, threadId } = await runConversation({
    threadId: input.threadId,
    participants: input.participants,
    topicHint: input.topicHint,
    lastSummary: input.lastSummary,
  });
  return { eventId, threadId };
}
