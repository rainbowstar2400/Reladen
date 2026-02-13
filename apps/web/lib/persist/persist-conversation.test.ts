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
const EXPERIENCE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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
    anchorExperienceId: EXPERIENCE_ID,
    grounded: true,
    groundingEvidence: ["fact:カフェ", "hook:invite"],
    fallbackMode: "experience",
  },
};

function makeEvalResult(
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
      if (table === "feelings") return [];
      return [];
    });
    mocks.putKV.mockImplementation(async (_table: string, payload: unknown) => payload);
  });

  it("events payload に grounding 用 meta を保持して保存する", async () => {
    const result = await persistConversation({
      gptOut: baseGptOut,
      evalResult: makeEvalResult(),
    });

    expect(result.eventId).toBe("00000000-0000-4000-8000-000000000001");

    const eventWrite = mocks.putKV.mock.calls.find((call) => call[0] === "events");
    expect(eventWrite).toBeTruthy();

    const payload = eventWrite?.[1] as { payload?: { meta?: Record<string, unknown> } };
    expect(payload.payload?.meta?.anchorExperienceId).toBe(EXPERIENCE_ID);
    expect(payload.payload?.meta?.grounded).toBe(true);
    expect(payload.payload?.meta?.fallbackMode).toBe("experience");
  });

  it("会話保存時に notifications まで書き込む", async () => {
    await persistConversation({
      gptOut: baseGptOut,
      evalResult: makeEvalResult(),
    });

    expect(
      mocks.putKV.mock.calls.some((call) => call[0] === "notifications"),
    ).toBe(true);
  });
});
