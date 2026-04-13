import { describe, expect, it } from "vitest";
import { eventSchemaStrict, type ConversationEventPayload } from "@repo/shared/types/conversation";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";

function baseConversationEvent() {
  const payload: ConversationEventPayload = {
    threadId: "44444444-4444-4444-8444-444444444444",
    participants: [A_ID, B_ID],
    lines: [{ speaker: A_ID, text: "テストです" }],
    meta: {
      tags: ["test"],
      memory: {
        summary: "会話した",
        topicsCovered: ["テスト"],
        unresolvedThreads: [],
        knowledgeGained: [],
      },
    },
    deltas: {
      aToB: { favor: 1, impression: "like" },
      bToA: { favor: 0, impression: "curious" },
    },
    systemLine: "SYSTEM: テスト",
  };

  return {
    id: "33333333-3333-4333-8333-333333333333",
    kind: "conversation",
    updated_at: "2026-03-20T00:00:00.000Z",
    deleted: false,
    payload,
  };
}

describe("eventSchemaStrict", () => {
  it("love を含む conversation payload を受理する", () => {
    const input = baseConversationEvent();
    input.payload.deltas.aToB = {
      favor: 2,
      impression: "love",
      impressionState: { base: "love", special: null, baseBeforeSpecial: "like" },
    };

    expect(() => eventSchemaStrict.parse(input)).not.toThrow();
  });

  it("既存の like/curious payload との互換を維持する", () => {
    const input = baseConversationEvent();
    expect(() => eventSchemaStrict.parse(input)).not.toThrow();
  });
});

