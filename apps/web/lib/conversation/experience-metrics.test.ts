import { describe, expect, it } from "vitest";
import type { EventLogStrict } from "@repo/shared/types/conversation";
import { computeConversationQualityMetrics } from "@/lib/conversation/experience-metrics";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";
const C_ID = "33333333-3333-4333-8333-333333333333";
const D_ID = "44444444-4444-4444-8444-444444444444";

function conversationEvent(input: {
  id: string;
  participants: [string, string];
  updatedAt: string;
  grounded?: boolean;
  anchorExperienceId?: string;
  anchorSignature?: string;
  groundingEvidence?: string[];
  deleted?: boolean;
}): EventLogStrict {
  return {
    id: input.id,
    kind: "conversation",
    payload: {
      threadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      participants: input.participants,
      lines: [{ speaker: input.participants[0], text: "会話" }],
      meta: {
        tags: [],
        newKnowledge: [],
        anchorExperienceId: input.anchorExperienceId,
        anchorSignature: input.anchorSignature,
        grounded: input.grounded,
        groundingEvidence: input.groundingEvidence,
      },
      deltas: {
        aToB: { favor: 0, impression: "none" },
        bToA: { favor: 0, impression: "none" },
      },
      systemLine: "SYSTEM:",
    } as any,
    updated_at: input.updatedAt,
    deleted: input.deleted ?? false,
  } as unknown as EventLogStrict;
}

describe("computeConversationQualityMetrics", () => {
  it("24時間接地率を算出する", () => {
    const now = "2026-02-13T12:00:00.000Z";
    const events: EventLogStrict[] = [
      conversationEvent({
        id: "e1",
        participants: [A_ID, B_ID],
        updatedAt: "2026-02-13T11:00:00.000Z",
        grounded: true,
        anchorExperienceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        groundingEvidence: ["fact:駅前"],
      }),
      conversationEvent({
        id: "e2",
        participants: [A_ID, B_ID],
        updatedAt: "2026-02-13T10:00:00.000Z",
        grounded: true,
        anchorExperienceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        groundingEvidence: ["fact:雨", "hook:share:聞いて"],
      }),
      conversationEvent({
        id: "e3",
        participants: [A_ID, B_ID],
        updatedAt: "2026-02-13T09:00:00.000Z",
        grounded: true,
        anchorExperienceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        groundingEvidence: [],
      }),
      conversationEvent({
        id: "e-old",
        participants: [A_ID, B_ID],
        updatedAt: "2026-02-11T08:00:00.000Z",
        grounded: true,
        anchorExperienceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        groundingEvidence: ["fact:古い"],
      }),
    ];

    const metrics = computeConversationQualityMetrics({
      events,
      nowIso: now,
    });

    expect(metrics.grounding.totalConversations).toBe(3);
    expect(metrics.grounding.groundedConversations).toBe(2);
    expect(metrics.grounding.rate).toBeCloseTo(2 / 3, 5);
  });

  it("同一 pair + anchorSignature の重複を連投として算出する", () => {
    const now = "2026-02-13T12:00:00.000Z";
    const events: EventLogStrict[] = [
      conversationEvent({
        id: "r1",
        participants: [A_ID, B_ID],
        updatedAt: "2026-02-13T08:00:00.000Z",
        anchorSignature: "lifestyle:a:b:cafe:share",
      }),
      conversationEvent({
        id: "r2",
        participants: [A_ID, B_ID],
        updatedAt: "2026-02-13T09:00:00.000Z",
        anchorSignature: "lifestyle:a:b:cafe:share",
      }),
      conversationEvent({
        id: "r3",
        participants: [A_ID, B_ID],
        updatedAt: "2026-02-13T10:00:00.000Z",
        anchorSignature: "work:a:b:office:reflect",
      }),
      conversationEvent({
        id: "r4",
        participants: [C_ID, D_ID],
        updatedAt: "2026-02-13T11:00:00.000Z",
        anchorSignature: "lifestyle:a:b:cafe:share",
      }),
      conversationEvent({
        id: "r5",
        participants: [A_ID, B_ID],
        updatedAt: "2026-02-11T06:00:00.000Z",
        anchorSignature: "lifestyle:a:b:cafe:share",
      }),
    ];

    const metrics = computeConversationQualityMetrics({
      events,
      nowIso: now,
      repeatWindowSize: 30,
      repeatCooldownHours: 36,
    });

    expect(metrics.repetition.totalConversations).toBe(5);
    expect(metrics.repetition.repeatedConversations).toBe(1);
    expect(metrics.repetition.rate).toBeCloseTo(0.2, 5);
  });

  it("conversation 以外や deleted は無視する", () => {
    const now = "2026-02-13T12:00:00.000Z";
    const events: EventLogStrict[] = [
      conversationEvent({
        id: "ok",
        participants: [A_ID, B_ID],
        updatedAt: "2026-02-13T11:30:00.000Z",
        grounded: true,
        anchorExperienceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        groundingEvidence: ["fact:駅前"],
      }),
      conversationEvent({
        id: "deleted",
        participants: [A_ID, B_ID],
        updatedAt: "2026-02-13T11:20:00.000Z",
        grounded: true,
        anchorExperienceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        groundingEvidence: ["fact:雨"],
        deleted: true,
      }),
      {
        id: "other",
        kind: "system",
        payload: {},
        updated_at: "2026-02-13T11:10:00.000Z",
        deleted: false,
      } as unknown as EventLogStrict,
    ];

    const metrics = computeConversationQualityMetrics({
      events,
      nowIso: now,
    });

    expect(metrics.grounding.totalConversations).toBe(1);
    expect(metrics.grounding.groundedConversations).toBe(1);
    expect(metrics.repetition.totalConversations).toBe(1);
    expect(metrics.repetition.repeatedConversations).toBe(0);
  });
});
