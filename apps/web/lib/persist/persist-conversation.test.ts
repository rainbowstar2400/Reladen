import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationOutput } from "@repo/shared/types/conversation-generation";
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

const baseGptOut: ConversationOutput = {
  threadId: THREAD_ID,
  participants: [A_ID, B_ID],
  topic: "休日の予定",
  lines: [
    { speaker: A_ID, text: "週末の予定ある？" },
    { speaker: B_ID, text: "カフェに行こうかな。" },
  ],
  meta: {
    tags: ["雑談・共通"],
    qualityHints: {
      turnBalance: "balanced",
      tone: "calm",
    },
    debug: [],
    memory: {
      summary: "休日の過ごし方について話した",
      topicsCovered: ["休日の予定", "カフェ"],
      unresolvedThreads: [],
      knowledgeGained: [],
    },
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
    recentDeltas: { aToB: [], bToA: [] },
    threadNextState: "ongoing",
    systemLine: "",
  };
}

describe("persistConversation", () => {
  const findFeelingWrite = (fromId: string, toId: string) => {
    return mocks.putKV.mock.calls
      .filter((call) => call[0] === "feelings")
      .map((call) => call[1] as {
        from_id?: string;
        to_id?: string;
        score?: number;
        label?: string;
        base_label?: string;
        special_label?: string | null;
        base_before_special?: string | null;
      })
      .find((payload) => payload.from_id === fromId && payload.to_id === toId);
  };
  const findNotificationWrite = () => {
    const call = mocks.putKV.mock.calls.find((entry) => entry[0] === "notifications");
    return call?.[1] as { snippet?: string } | undefined;
  };

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

  it("events payload に memory を保持して保存する", async () => {
    const result = await persistConversation({
      gptOut: baseGptOut,
      evalResult: makeEvalResult(),
    });

    expect(result.eventId).toBe("00000000-0000-4000-8000-000000000001");

    const eventWrite = mocks.putKV.mock.calls.find((call) => call[0] === "events");
    expect(eventWrite).toBeTruthy();

    const payload = eventWrite?.[1] as { payload?: { meta?: Record<string, unknown> } };
    expect(payload.payload?.meta?.memory).toEqual({
      summary: "休日の過ごし方について話した",
      topicsCovered: ["休日の予定", "カフェ"],
      unresolvedThreads: [],
      knowledgeGained: [],
    });
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

  it("会話通知の snippet は短文でも末尾に … が付く", async () => {
    await persistConversation({
      gptOut: {
        ...baseGptOut,
        lines: [{ speaker: A_ID, text: "短文です" }],
      },
      evalResult: makeEvalResult(),
    });

    expect(findNotificationWrite()?.snippet).toBe("短文です…");
  });

  it("会話通知の snippet は本文20文字で切り詰められる", async () => {
    await persistConversation({
      gptOut: {
        ...baseGptOut,
        lines: [{ speaker: A_ID, text: "1234567890123456789012345" }],
      },
      evalResult: makeEvalResult(),
    });

    expect(findNotificationWrite()?.snippet).toBe("12345678901234567890…");
  });

  it("feelings 未存在時は好感度を 30 から開始する", async () => {
    await persistConversation({
      gptOut: baseGptOut,
      evalResult: makeEvalResult(),
    });

    const ab = findFeelingWrite(A_ID, B_ID);
    const ba = findFeelingWrite(B_ID, A_ID);
    expect(ab?.score).toBe(30);
    expect(ba?.score).toBe(30);
  });

  it("既存の score=0 は補正せず維持する", async () => {
    mocks.listKV.mockImplementation(async (table: string) => {
      if (table === "feelings") {
        return [
          { id: "f1", from_id: A_ID, to_id: B_ID, label: "none", score: 0 },
          { id: "f2", from_id: B_ID, to_id: A_ID, label: "none", score: 0 },
        ];
      }
      return [];
    });

    await persistConversation({
      gptOut: baseGptOut,
      evalResult: makeEvalResult(),
    });

    const ab = findFeelingWrite(A_ID, B_ID);
    const ba = findFeelingWrite(B_ID, A_ID);
    expect(ab?.score).toBe(0);
    expect(ba?.score).toBe(0);
  });

  it("既存 score が NaN/undefined の場合は 30 に補正する", async () => {
    mocks.listKV.mockImplementation(async (table: string) => {
      if (table === "feelings") {
        return [
          { id: "f1", from_id: A_ID, to_id: B_ID, label: "none", score: Number.NaN },
          { id: "f2", from_id: B_ID, to_id: A_ID, label: "none" },
        ];
      }
      return [];
    });

    await persistConversation({
      gptOut: baseGptOut,
      evalResult: makeEvalResult(),
    });

    const ab = findFeelingWrite(A_ID, B_ID);
    const ba = findFeelingWrite(B_ID, A_ID);
    expect(ab?.score).toBe(30);
    expect(ba?.score).toBe(30);
  });

  it("impressionState の3層を feelings に保存する", async () => {
    const evalResult = makeEvalResult();
    evalResult.deltas.aToB.impressionState = {
      base: "maybe_like",
      special: "awkward",
      baseBeforeSpecial: "curious",
    };
    evalResult.deltas.bToA.impressionState = {
      base: "like",
      special: null,
      baseBeforeSpecial: null,
    };

    await persistConversation({
      gptOut: baseGptOut,
      evalResult,
    });

    const ab = findFeelingWrite(A_ID, B_ID);
    const ba = findFeelingWrite(B_ID, A_ID);
    expect(ab?.label).toBe("awkward");
    expect(ab?.base_label).toBe("maybe_like");
    expect(ab?.special_label).toBe("awkward");
    expect(ab?.base_before_special).toBe("curious");
    expect(ba?.label).toBe("like");
    expect(ba?.base_label).toBe("like");
    expect(ba?.special_label).toBe(null);
    expect(ba?.base_before_special).toBe(null);
  });
});
