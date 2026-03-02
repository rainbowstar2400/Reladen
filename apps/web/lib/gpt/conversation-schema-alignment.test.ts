import { describe, expect, it } from "vitest";
import { conversationOutputSchema } from "@repo/shared/types/conversation-generation";
import { conversationResponseSchema } from "@repo/shared/gpt/schemas/conversation-output";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";
const THREAD_ID = "33333333-3333-4333-8333-333333333333";

describe("conversation response schema alignment", () => {
  it("OpenAI JSON Schema のUUIDフィールドに format=uuid を設定する", () => {
    const schema = conversationResponseSchema.schema;
    const lines = schema.properties.lines.items;
    const knowledge = schema.properties.meta.properties.memory.properties.knowledgeGained.items;

    expect(schema.properties.threadId).toMatchObject({ type: "string", format: "uuid" });
    expect(schema.properties.participants.items).toMatchObject({ type: "string", format: "uuid" });
    expect(lines.properties.speaker).toMatchObject({ type: "string", format: "uuid" });
    expect(knowledge.properties.about).toMatchObject({ type: "string", format: "uuid" });
  });

  it("Zod スキーマは knowledgeGained.about の非UUIDを拒否する", () => {
    const parsed = conversationOutputSchema.safeParse({
      threadId: THREAD_ID,
      participants: [A_ID, B_ID],
      topic: "雑談",
      lines: [{ speaker: A_ID, text: "こんにちは" }],
      meta: {
        tags: [],
        signals: ["continue"],
        qualityHints: {
          turnBalance: "balanced",
          tone: "neutral",
        },
        debug: [],
        memory: {
          summary: "要約",
          topicsCovered: [],
          unresolvedThreads: [],
          knowledgeGained: [
            {
              about: "Alice",
              fact: "パンが好き",
            },
          ],
        },
      },
    });

    expect(parsed.success).toBe(false);
  });
});
