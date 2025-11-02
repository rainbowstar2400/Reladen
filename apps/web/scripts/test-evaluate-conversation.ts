import { evaluateConversation } from "@/lib/evaluation/evaluate-conversation";
import type { GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";

const mockOutput: GptConversationOutput = {
  threadId: "t-001",
  participants: ["A", "B"],
  topic: "映画",
  lines: [
    { speaker: "A", text: "昨日の映画、良かったね。" },
    { speaker: "B", text: "うん、特に後半の展開がすごかった。" },
  ],
  meta: {
    tags: ["共感", "軽い雑談"],
    newKnowledge: [{ target: "B", key: "likes.movie.true" }],
    signals: ["continue"],
    qualityHints: { turnBalance: "balanced", tone: "friendly" },
  },
};

const beliefs = {
  A: {
    id: "a1",
    residentId: "A",
    worldFacts: [],
    personKnowledge: {},
    updated_at: new Date().toISOString(),
    deleted: false,
  },
  B: {
    id: "b1",
    residentId: "B",
    worldFacts: [],
    personKnowledge: {},
    updated_at: new Date().toISOString(),
    deleted: false,
  },
};

const result = evaluateConversation({ output: mockOutput, beliefs });
console.log(result);
