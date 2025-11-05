// apps/web/app/actions/conversation.ts
"use server";

import { runConversation } from "@/lib/conversation/run-conversation";
import { selectConversationCandidates } from "@/lib/conversation/candidates";
import { getResidentsByIds } from "@/lib/data/residents-server";

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
 // 1) 参加者2名の就寝チェック
 const now = new Date();
 const [idA, idB] = input.participants;
 const residents = await getResidentsByIds([idA, idB]);
 if (!residents || residents.length < 2) {
   throw new Error("participants_not_found");
 }
 const awake = selectConversationCandidates(now, residents); // sleeping を除外
 if (awake.length !== residents.length) {
   // 少なくとも1名が就寝中
   const awakeIds = new Set(awake.map(r => r.id));
   const sleepingIds = residents.filter(r => !awakeIds.has(r.id)).map(r => r.id);
   const err = new Error(`sleeping_participant:${sleepingIds.join(",")}`);
   throw err;
 }

  const { eventId, threadId } = await runConversation({
    threadId: input.threadId,
    participants: input.participants,
    topicHint: input.topicHint,
    lastSummary: input.lastSummary,
  });
  return { eventId, threadId };
}
