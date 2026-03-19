import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EvalInput, EvaluationResult } from "@/lib/evaluation/evaluate-conversation";

const mocks = vi.hoisted(() => ({
  listKV: vi.fn(),
  putKV: vi.fn(),
  MockKvUnauthenticatedError: class MockKvUnauthenticatedError extends Error {},
  callGptForConversation: vi.fn(),
  callGptForSituation: vi.fn(),
  evaluateConversation: vi.fn(),
  persistConversation: vi.fn(),
  newId: vi.fn(),
  selectTopic: vi.fn(),
  buildConversationStructure: vi.fn(),
}));

vi.mock("@/lib/db/kv-server", () => ({
  listKV: mocks.listKV,
  putKV: mocks.putKV,
  KvUnauthenticatedError: mocks.MockKvUnauthenticatedError,
}));

vi.mock("@/lib/gpt/call-gpt-for-conversation", () => ({
  callGptForConversation: mocks.callGptForConversation,
}));

vi.mock("@/lib/gpt/call-gpt-for-situation", () => ({
  callGptForSituation: mocks.callGptForSituation,
}));

vi.mock("@/lib/evaluation/evaluate-conversation", () => ({
  evaluateConversation: mocks.evaluateConversation,
}));

vi.mock("@/lib/persist/persist-conversation", () => ({
  persistConversation: mocks.persistConversation,
}));

vi.mock("@/lib/newId", () => ({
  newId: mocks.newId,
}));

vi.mock("@repo/shared/logic/topic-selection", async () => {
  const actual = await vi.importActual<typeof import("@repo/shared/logic/topic-selection")>(
    "@repo/shared/logic/topic-selection",
  );
  return {
    ...actual,
    selectTopic: mocks.selectTopic,
  };
});

vi.mock("@repo/shared/logic/conversation-structure", async () => {
  const actual = await vi.importActual<typeof import("@repo/shared/logic/conversation-structure")>(
    "@repo/shared/logic/conversation-structure",
  );
  return {
    ...actual,
    buildConversationStructure: mocks.buildConversationStructure,
  };
});

import {
  ConversationStartError,
  runConversation,
  runConversationFromApi,
} from "@/lib/conversation/run-conversation";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";
const THREAD_ID = "33333333-3333-4333-8333-333333333333";
const EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const baseEvalResult: EvaluationResult = {
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

function baseResidents() {
  return [
    {
      id: A_ID,
      name: "Alice",
      traits: { sociability: 2, empathy: 3, stubbornness: 2, activity: 2, expressiveness: 2 },
      interests: ["料理"],
      first_person: null,
      speech_preset: null,
      gender: "female",
      age: 21,
      occupation: "学生",
      mbti: "ISFJ",
      deleted: false,
    },
    {
      id: B_ID,
      name: "Bob",
      traits: { sociability: 5, empathy: 3, stubbornness: 3, activity: 5, expressiveness: 4 },
      interests: ["釣り", "料理"],
      first_person: null,
      speech_preset: null,
      gender: "male",
      age: 22,
      occupation: "会社員",
      mbti: "ESTP",
      deleted: false,
    },
  ];
}

describe("run-conversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.newId.mockReturnValue(THREAD_ID);
    mocks.putKV.mockResolvedValue(undefined);
    mocks.callGptForSituation.mockResolvedValue("駅前の信号待ちで隣に立ち、自然に会話が始まった");

    mocks.listKV.mockImplementation(async (table: string) => {
      switch (table) {
        case "topic_threads":
          return [];
        case "residents":
          return baseResidents();
        case "presets":
          return [];
        case "relations":
          return [
            {
              id: "44444444-4444-4444-8444-444444444444",
              a_id: A_ID,
              b_id: B_ID,
              type: "friend",
              deleted: false,
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          ];
        case "feelings":
          return [];
        case "events":
          return [];
        default:
          return [];
      }
    });

    mocks.selectTopic.mockImplementation((_input, initiator) => ({
      selected: {
        source: "personal_interest",
        label: "釣り",
        detail: `${initiator.name}の興味`,
      },
      candidates: [
        { source: "personal_interest", label: "釣り", detail: "候補", score: 8 },
      ],
    }));

    mocks.buildConversationStructure.mockImplementation((input) => {
      const initiator = input.initiatorOverrideId === input.characterB.id
        ? input.characterB
        : input.characterA;
      const responder = initiator.id === input.characterA.id ? input.characterB : input.characterA;
      return {
        initiatorId: initiator.id,
        initiatorName: initiator.name,
        responderId: responder.id,
        responderName: responder.name,
        initiatorStance: "enthusiastic",
        responderStance: "agreeable",
        temperature: "warm",
        initiatorTurnLength: "1〜2文",
        responderTurnLength: "1文",
      };
    });

    mocks.callGptForConversation.mockImplementation(async (promptInput, structure) => ({
      output: {
        threadId: promptInput.threadId,
        participants: [promptInput.characters[0].id, promptInput.characters[1].id],
        topic: promptInput.topic.label,
        lines: [
          { speaker: structure.initiatorId, text: "こんにちは" },
          { speaker: structure.responderId, text: "やあ" },
          { speaker: structure.initiatorId, text: "元気？" },
          { speaker: structure.responderId, text: "元気だよ" },
          { speaker: structure.initiatorId, text: "釣りの話しよう" },
          { speaker: structure.responderId, text: "いいね" },
        ],
        meta: {
          tags: [],
          qualityHints: {
            turnBalance: "balanced",
            tone: "neutral",
          },
          debug: [],
          memory: {
            summary: "会話した",
            topicsCovered: ["釣り"],
            unresolvedThreads: [],
            knowledgeGained: [],
          },
        },
      },
      retried: false,
      violations: [],
    }));

    mocks.evaluateConversation.mockImplementation((_input: EvalInput) => baseEvalResult);
    mocks.persistConversation.mockResolvedValue({ eventId: EVENT_ID });
  });

  it("threadId 経路では topic_threads から participants を解決する", async () => {
    mocks.listKV.mockImplementation(async (table: string) => {
      if (table === "topic_threads") {
        return [
          {
            id: THREAD_ID,
            participants: [A_ID, B_ID],
            deleted: false,
          },
        ];
      }
      return (await (async () => {
        switch (table) {
          case "residents":
            return baseResidents();
          case "presets":
            return [];
          case "relations":
            return [{ a_id: A_ID, b_id: B_ID, type: "friend", deleted: false }];
          case "feelings":
            return [];
          default:
            return [];
        }
      })()) as unknown[];
    });

    const result = await runConversationFromApi({ threadId: THREAD_ID });

    expect(result).toEqual({ eventId: EVENT_ID, threadId: THREAD_ID });
    expect(mocks.evaluateConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: [A_ID, B_ID],
      }),
    );
  });

  it("thread が存在しない場合は thread_not_found を返す", async () => {
    const result = runConversationFromApi({ threadId: THREAD_ID });
    await expect(result).rejects.toBeInstanceOf(ConversationStartError);
    await expect(result).rejects.toMatchObject({
      code: "thread_not_found",
      status: 404,
    });
  });

  it("thread.participants が不正なら invalid_thread_participants を返す", async () => {
    mocks.listKV.mockImplementation(async (table: string) => {
      if (table === "topic_threads") {
        return [
          {
            id: THREAD_ID,
            participants: [A_ID],
            deleted: false,
          },
        ];
      }
      return [];
    });

    await expect(runConversationFromApi({ threadId: THREAD_ID })).rejects.toMatchObject({
      code: "invalid_thread_participants",
      status: 422,
    });
  });

  it("presets 取得失敗時は preset_load_failed を返す", async () => {
    mocks.listKV.mockImplementation(async (table: string) => {
      if (table === "presets") {
        throw new Error("presets unavailable");
      }
      if (table === "residents") {
        return baseResidents();
      }
      if (table === "relations") {
        return [{ a_id: A_ID, b_id: B_ID, type: "friend", deleted: false }];
      }
      if (table === "feelings") {
        return [];
      }
      return [];
    });

    await expect(runConversationFromApi({ participants: [A_ID, B_ID] })).rejects.toMatchObject({
      code: "preset_load_failed",
      status: 503,
    });
  });

  it("presets 取得時の認証エラーはそのまま再throwする", async () => {
    mocks.listKV.mockImplementation(async (table: string) => {
      if (table === "presets") {
        throw new mocks.MockKvUnauthenticatedError("unauthenticated");
      }
      return [];
    });

    await expect(runConversationFromApi({ participants: [A_ID, B_ID] })).rejects.toBeInstanceOf(
      mocks.MockKvUnauthenticatedError,
    );
  });

  it("runConversation は place なし環境でも話題選定の主導者を構造決定へ引き継ぐ", async () => {
    const result = await runConversation({
      participants: [A_ID, B_ID],
      characters: {
        [A_ID]: {
          id: A_ID,
          name: "Alice",
          traits: { sociability: 2, activity: 2, expressiveness: 2, stubbornness: 2 },
          interests: ["料理"],
        },
        [B_ID]: {
          id: B_ID,
          name: "Bob",
          traits: { sociability: 5, activity: 5, expressiveness: 4, stubbornness: 3 },
          interests: ["釣り", "料理"],
        },
      },
      relation: {
        type: "friend",
        feelingAtoB: { label: "curious", score: 50 },
        feelingBtoA: { label: "like", score: 70 },
      },
      environment: {
        timeOfDay: "昼",
      },
      threadId: THREAD_ID,
      situation: "昼休みの廊下で同時に足を止め、目が合った",
    });

    const selectedInitiator = mocks.selectTopic.mock.calls[0]?.[1];
    const topicInput = mocks.selectTopic.mock.calls[0]?.[0];
    const structureInput = mocks.buildConversationStructure.mock.calls[0]?.[0];

    expect(selectedInitiator?.id).toBe(B_ID);
    expect(topicInput?.situation).toBe("昼休みの廊下で同時に足を止め、目が合った");
    expect(structureInput?.initiatorOverrideId).toBe(selectedInitiator?.id);
    expect(result.debug.structure.initiator).toBe("Bob");
  });

  it("runConversationFromApi は会話履歴の situation を recentSituations として渡す", async () => {
    mocks.listKV.mockImplementation(async (table: string) => {
      switch (table) {
        case "topic_threads":
          return [];
        case "residents":
          return baseResidents();
        case "presets":
          return [];
        case "relations":
          return [{ a_id: A_ID, b_id: B_ID, type: "friend", deleted: false }];
        case "feelings":
          return [];
        case "events":
          return [
            {
              id: "e3",
              kind: "conversation",
              updated_at: "2026-03-20T10:00:00.000Z",
              deleted: false,
              payload: {
                participants: [A_ID, B_ID],
                situation: "雨宿りの軒先で並んだ瞬間、互いに気づいた",
                meta: {
                  memory: {
                    summary: "会話した",
                    topicsCovered: ["天気"],
                    unresolvedThreads: [],
                    knowledgeGained: [],
                  },
                },
              },
            },
            {
              id: "e2",
              kind: "conversation",
              updated_at: "2026-03-20T09:00:00.000Z",
              deleted: false,
              payload: {
                participants: [A_ID, B_ID],
                situation: "昼休みの廊下で同時に足を止め、目が合った",
                meta: {
                  memory: {
                    summary: "会話した",
                    topicsCovered: ["昼休み"],
                    unresolvedThreads: [],
                    knowledgeGained: [],
                  },
                },
              },
            },
            {
              id: "e1",
              kind: "conversation",
              updated_at: "2026-03-20T08:00:00.000Z",
              deleted: false,
              payload: {
                participants: [A_ID, B_ID],
                situation: "雨宿りの軒先で並んだ瞬間、互いに気づいた",
                meta: {
                  memory: {
                    summary: "会話した",
                    topicsCovered: ["帰り道"],
                    unresolvedThreads: [],
                    knowledgeGained: [],
                  },
                },
              },
            },
          ];
        default:
          return [];
      }
    });

    await runConversationFromApi({ participants: [A_ID, B_ID] });

    expect(mocks.callGptForSituation).toHaveBeenCalledWith(
      expect.objectContaining({
        recentSituations: [
          "雨宿りの軒先で並んだ瞬間、互いに気づいた",
          "昼休みの廊下で同時に足を止め、目が合った",
        ],
      }),
    );
  });

  it("runConversationFromApi は relation_trigger を residentId/targetId 形式で保存する", async () => {
    mocks.listKV.mockImplementation(async (table: string) => {
      switch (table) {
        case "topic_threads":
          return [];
        case "residents":
          return baseResidents();
        case "presets":
          return [];
        case "relations":
          return [{ a_id: A_ID, b_id: B_ID, type: "friend", deleted: false }];
        case "feelings":
          return [
            { id: "f1", from_id: A_ID, to_id: B_ID, label: "maybe_like", score: 60, deleted: false },
            { id: "f2", from_id: B_ID, to_id: A_ID, label: "curious", score: 40, deleted: false },
          ];
        case "events":
          return [];
        default:
          return [];
      }
    });
    mocks.evaluateConversation.mockReturnValueOnce({
      ...baseEvalResult,
      deltas: {
        aToB: {
          favor: 0,
          impression: "maybe_like",
          impressionState: { base: "maybe_like", special: null, baseBeforeSpecial: null },
        },
        bToA: {
          favor: 0,
          impression: "curious",
          impressionState: { base: "curious", special: null, baseBeforeSpecial: null },
        },
      },
    });

    await runConversationFromApi({ participants: [A_ID, B_ID] });

    const relationTriggerWrite = mocks.putKV.mock.calls.find(
      ([table, value]) => table === "events" && value?.kind === "relation_trigger",
    );
    expect(relationTriggerWrite).toBeTruthy();
    expect(relationTriggerWrite?.[1]).toMatchObject({
      kind: "relation_trigger",
      payload: {
        trigger: "confession",
        residentId: A_ID,
        targetId: B_ID,
        participants: [A_ID, B_ID],
        currentRelation: "friend",
        handled: false,
      },
    });
    expect(relationTriggerWrite?.[1]?.payload?.subjectDirection).toBeUndefined();
    expect(relationTriggerWrite?.[1]?.payload?.type).toBeUndefined();
  });
});
