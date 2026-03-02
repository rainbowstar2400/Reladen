import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EvalInput, EvaluationResult } from "@/lib/evaluation/evaluate-conversation";

const mocks = vi.hoisted(() => ({
  listKV: vi.fn(),
  callGptForConversation: vi.fn(),
  evaluateConversation: vi.fn(),
  persistConversation: vi.fn(),
  newId: vi.fn(),
  selectTopic: vi.fn(),
  buildConversationStructure: vi.fn(),
}));

vi.mock("@/lib/db/kv-server", () => ({
  listKV: mocks.listKV,
}));

vi.mock("@/lib/gpt/call-gpt-for-conversation", () => ({
  callGptForConversation: mocks.callGptForConversation,
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
          signals: ["continue"],
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

  it("runConversation は話題選定の主導者を構造決定にも引き継ぐ", async () => {
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
        place: "商店街",
        timeOfDay: "昼",
      },
      threadId: THREAD_ID,
    });

    const selectedInitiator = mocks.selectTopic.mock.calls[0]?.[1];
    const structureInput = mocks.buildConversationStructure.mock.calls[0]?.[0];

    expect(selectedInitiator?.id).toBe(B_ID);
    expect(structureInput?.initiatorOverrideId).toBe(selectedInitiator?.id);
    expect(result.debug.structure.initiator).toBe("Bob");
  });
});
