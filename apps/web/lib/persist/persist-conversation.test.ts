import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import type { EvaluationResult } from "@/lib/evaluation/evaluate-conversation";

const mocks = vi.hoisted(() => ({
  putKV: vi.fn(),
  listKV: vi.fn(),
  newId: vi.fn(),
}));

vi.mock("@/lib/db/kv-server", () => ({
  putKV: mocks.putKV,
  listKV: mocks.listKV,
}));

vi.mock("@/lib/newId", () => ({
  newId: mocks.newId,
}));

import { persistConversation } from "@/lib/persist/persist-conversation";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";
const THREAD_ID = "33333333-3333-4333-8333-333333333333";

const baseGptOut: GptConversationOutput = {
  threadId: THREAD_ID,
  participants: [A_ID, B_ID],
  topic: "休日の予定",
  lines: [
    { speaker: A_ID, text: "週末の予定ある？" },
    { speaker: B_ID, text: "カフェに行こうかな。" },
  ],
  meta: {
    tags: ["雑談・共通"],
    newKnowledge: [],
    signals: ["continue"],
    qualityHints: {
      turnBalance: "balanced",
      tone: "calm",
    },
    debug: [],
  },
};

function makeEvalResult(
  newBeliefs: EvaluationResult["newBeliefs"],
): EvaluationResult {
  return {
    deltas: {
      aToB: {
        favor: 0,
        impression: "none",
        impressionState: {
          base: "none",
          special: null,
          baseBeforeSpecial: null,
        },
      },
      bToA: {
        favor: 0,
        impression: "none",
        impressionState: {
          base: "none",
          special: null,
          baseBeforeSpecial: null,
        },
      },
    },
    newBeliefs,
    threadNextState: "ongoing",
    systemLine: "",
  };
}

describe("persistConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    let seq = 0;
    mocks.newId.mockImplementation(() => {
      seq += 1;
      return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
    });
    mocks.listKV.mockImplementation(async (table: string) => {
      if (table === "beliefs") return [];
      if (table === "feelings") return [];
      return [];
    });
    mocks.putKV.mockImplementation(async (_table: string, payload: unknown) => payload);
  });

  it("newBeliefs があると beliefs に world_facts 配列で保存する", async () => {
    const result = await persistConversation({
      gptOut: baseGptOut,
      evalResult: makeEvalResult([
        { target: A_ID, key: "likes_coffee" },
      ]),
    });

    expect(result.eventId).toBe("00000000-0000-4000-8000-000000000001");

    const beliefWrites = mocks.putKV.mock.calls.filter(
      (call) => call[0] === "beliefs",
    );
    expect(beliefWrites).toHaveLength(1);
    const payload = beliefWrites[0][1] as {
      resident_id: string;
      world_facts: unknown;
      person_knowledge: Record<string, { keys: string[] }>;
    };
    expect(payload.resident_id).toBe(A_ID);
    expect(Array.isArray(payload.world_facts)).toBe(true);
    expect(payload.person_knowledge[B_ID]?.keys).toEqual(["likes_coffee"]);
  });

  it("beliefs 保存失敗時は warn のみで会話永続化を継続する", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.putKV.mockImplementation(async (table: string, payload: unknown) => {
      if (table === "beliefs") {
        throw new Error("belief write failed");
      }
      return payload;
    });

    await expect(
      persistConversation({
        gptOut: baseGptOut,
        evalResult: makeEvalResult([
          { target: A_ID, key: "likes_coffee" },
        ]),
      }),
    ).resolves.toMatchObject({
      eventId: "00000000-0000-4000-8000-000000000001",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "[persistConversation] Failed to upsert beliefs from new knowledge.",
      expect.objectContaining({
        threadId: THREAD_ID,
        participants: [A_ID, B_ID],
        newBeliefsCount: 1,
        error: "belief write failed",
      }),
    );
    expect(
      mocks.putKV.mock.calls.some((call) => call[0] === "notifications"),
    ).toBe(true);
    warnSpy.mockRestore();
  });
});

