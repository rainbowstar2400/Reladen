import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listKV: vi.fn(),
  generateAndPersistExperienceForParticipants: vi.fn(),
  callGptForConversation: vi.fn(),
  evaluateConversation: vi.fn(),
  persistConversation: vi.fn(),
  newId: vi.fn(),
}));

vi.mock("@/lib/db/kv-server", () => ({
  listKV: mocks.listKV,
}));

vi.mock("@/lib/conversation/experience-generator", () => ({
  generateAndPersistExperienceForParticipants: mocks.generateAndPersistExperienceForParticipants,
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

import { runConversation } from "@/lib/conversation/run-conversation";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";
const THREAD_ID = "33333333-3333-4333-8333-333333333333";
const LAST_EVENT_ID = "44444444-4444-4444-8444-444444444444";
const EVENT_ID = "55555555-5555-4555-8555-555555555555";

function setupListKv(data: Record<string, unknown>) {
  mocks.listKV.mockImplementation(async (table: string) => {
    const value = data[table];
    if (value instanceof Error) throw value;
    return value ?? [];
  });
}

const gptOut = {
  threadId: THREAD_ID,
  participants: [A_ID, B_ID] as [string, string],
  topic: "休日の過ごし方",
  lines: [
    { speaker: A_ID, text: "今日は何してた？" },
    { speaker: B_ID, text: "散歩してたよ。" },
  ],
  meta: {
    tags: ["雑談・共通"],
    newKnowledge: [],
    signals: ["continue"] as Array<"continue" | "close" | "park">,
    qualityHints: { turnBalance: "balanced" as const, tone: "calm" },
    debug: [],
  },
};

const evalResult = {
  deltas: {
    aToB: {
      favor: 0,
      impression: "none",
      impressionState: { base: "none", special: null, baseBeforeSpecial: null },
    },
    bToA: {
      favor: 0,
      impression: "none",
      impressionState: { base: "none", special: null, baseBeforeSpecial: null },
    },
  },
  newBeliefs: [],
  threadNextState: "ongoing" as const,
  systemLine: "",
};

describe("runConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateAndPersistExperienceForParticipants.mockResolvedValue({ created: false });
    mocks.newId.mockReturnValue(THREAD_ID);
    mocks.callGptForConversation.mockResolvedValue(gptOut);
    mocks.evaluateConversation.mockReturnValue(evalResult);
    mocks.persistConversation.mockResolvedValue({ eventId: EVENT_ID });
  });

  it("関係性・感情・直近台詞を収集して pairContext を渡す", async () => {
    setupListKv({
      topic_threads: [
        {
          id: THREAD_ID,
          participants: [A_ID, B_ID],
          status: "ongoing",
          topic: "休日の過ごし方",
          last_event_id: LAST_EVENT_ID,
          updated_at: "2026-01-01T09:00:00.000Z",
          deleted: false,
        },
      ],
      relations: [
        {
          a_id: A_ID,
          b_id: B_ID,
          type: "friend",
          updated_at: "2026-01-01T09:00:00.000Z",
          deleted: false,
        },
      ],
      beliefs: [],
      presets: [],
      residents: [
        { id: A_ID, name: "遥", first_person: null, speech_preset: null, deleted: false },
        { id: B_ID, name: "湊", first_person: null, speech_preset: null, deleted: false },
      ],
      feelings: [
        {
          from_id: A_ID,
          to_id: B_ID,
          label: "like",
          score: 70,
          updated_at: "2026-01-01T09:00:00.000Z",
          deleted: false,
        },
        {
          from_id: B_ID,
          to_id: A_ID,
          label: "curious",
          score: 45,
          updated_at: "2026-01-01T09:00:00.000Z",
          deleted: false,
        },
      ],
      events: [
        {
          id: LAST_EVENT_ID,
          kind: "conversation",
          deleted: false,
          payload: {
            lines: [
              { speaker: A_ID, text: "古い発話" },
              { speaker: B_ID, text: "最近1" },
              { speaker: A_ID, text: "最近2" },
              { speaker: B_ID, text: "最近3" },
              { speaker: A_ID, text: "最近4" },
            ],
          },
        },
      ],
    });

    const result = await runConversation({
      threadId: THREAD_ID,
      participants: [A_ID, B_ID],
    });

    expect(result.eventId).toBe(EVENT_ID);
    expect(mocks.generateAndPersistExperienceForParticipants).toHaveBeenCalledWith(
      expect.objectContaining({ participants: [A_ID, B_ID] }),
    );
    expect(mocks.callGptForConversation).toHaveBeenCalledTimes(1);
    const callArg = mocks.callGptForConversation.mock.calls[0][0];
    expect(callArg.pairContext).toMatchObject({
      relationType: "friend",
      feelings: {
        aToB: { label: "like", score: 70 },
        bToA: { label: "curious", score: 45 },
      },
    });
    expect(callArg.pairContext?.recentLines).toHaveLength(4);
    expect(callArg.pairContext?.recentLines?.[0]?.text).toBe("最近1");
    expect(callArg.pairContext?.recentLines?.[3]?.text).toBe("最近4");
    expect(callArg.lastSummary).toBe("直近会話: 湊: 最近3 / 遥: 最近4");
  });

  it("relation が none の場合は中断し GPT 呼び出しを行わない", async () => {
    setupListKv({
      topic_threads: [
        {
          id: THREAD_ID,
          participants: [A_ID, B_ID],
          status: "ongoing",
          updated_at: "2026-01-01T09:00:00.000Z",
          deleted: false,
        },
      ],
      relations: [
        {
          a_id: A_ID,
          b_id: B_ID,
          type: "none",
          updated_at: "2026-01-01T09:00:00.000Z",
          deleted: false,
        },
      ],
    });

    await expect(
      runConversation({
        threadId: THREAD_ID,
        participants: [A_ID, B_ID],
      }),
    ).rejects.toThrow("relation is 'none'");
    expect(mocks.callGptForConversation).not.toHaveBeenCalled();
  });

  it("追加文脈の読み込み失敗時は warn のみで会話生成を継続する", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    setupListKv({
      topic_threads: [
        {
          id: THREAD_ID,
          participants: [A_ID, B_ID],
          status: "ongoing",
          updated_at: "2026-01-01T09:00:00.000Z",
          deleted: false,
        },
      ],
      relations: new Error("relations unavailable"),
      beliefs: [],
      presets: [],
      residents: [
        { id: A_ID, name: "遥", first_person: null, speech_preset: null, deleted: false },
        { id: B_ID, name: "湊", first_person: null, speech_preset: null, deleted: false },
      ],
      feelings: new Error("feelings unavailable"),
      events: new Error("events unavailable"),
    });

    const result = await runConversation({
      threadId: THREAD_ID,
      participants: [A_ID, B_ID],
    });

    expect(result.threadId).toBe(THREAD_ID);
    expect(mocks.callGptForConversation).toHaveBeenCalledTimes(1);
    const callArg = mocks.callGptForConversation.mock.calls[0][0];
    expect(callArg.pairContext).toBeUndefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("topic_shift がない継続会話では既存 topic を維持する", async () => {
    mocks.callGptForConversation.mockResolvedValue({
      ...gptOut,
      topic: "散歩",
      meta: {
        ...gptOut.meta,
        tags: [],
      },
      lines: [
        { speaker: A_ID, text: "映画の話なんだけど、主演がよかった。" },
        { speaker: B_ID, text: "明日は猫カフェに行く。" },
      ],
    });

    setupListKv({
      topic_threads: [
        {
          id: THREAD_ID,
          participants: [A_ID, B_ID],
          status: "ongoing",
          topic: "映画",
          updated_at: "2026-01-01T09:00:00.000Z",
          deleted: false,
        },
      ],
      relations: [
        {
          a_id: A_ID,
          b_id: B_ID,
          type: "friend",
          updated_at: "2026-01-01T09:00:00.000Z",
          deleted: false,
        },
      ],
      beliefs: [],
      presets: [],
      residents: [
        { id: A_ID, name: "遥", first_person: null, speech_preset: null, deleted: false },
        { id: B_ID, name: "湊", first_person: null, speech_preset: null, deleted: false },
      ],
      feelings: [],
      events: [],
    });

    const result = await runConversation({
      threadId: THREAD_ID,
      participants: [A_ID, B_ID],
    });

    expect(result.gptOut.topic).toBe("映画");
    const persistArg = mocks.persistConversation.mock.calls[0][0];
    expect(persistArg.gptOut.topic).toBe("映画");
  });

  it("topic_shift + 橋渡しありなら継続会話でも topic を更新する", async () => {
    mocks.callGptForConversation.mockResolvedValue({
      ...gptOut,
      topic: "散歩",
      meta: {
        ...gptOut.meta,
        tags: ["topic_shift"],
      },
      lines: [
        { speaker: A_ID, text: "ところで、映画の話から少し広げて明日は散歩に行きたいんだ。" },
        { speaker: B_ID, text: "いいね、散歩のあとでまた映画の話もしたい。" },
      ],
    });

    setupListKv({
      topic_threads: [
        {
          id: THREAD_ID,
          participants: [A_ID, B_ID],
          status: "ongoing",
          topic: "映画",
          updated_at: "2026-01-01T09:00:00.000Z",
          deleted: false,
        },
      ],
      relations: [
        {
          a_id: A_ID,
          b_id: B_ID,
          type: "friend",
          updated_at: "2026-01-01T09:00:00.000Z",
          deleted: false,
        },
      ],
      beliefs: [],
      presets: [],
      residents: [
        { id: A_ID, name: "遥", first_person: null, speech_preset: null, deleted: false },
        { id: B_ID, name: "湊", first_person: null, speech_preset: null, deleted: false },
      ],
      feelings: [],
      events: [],
    });

    const result = await runConversation({
      threadId: THREAD_ID,
      participants: [A_ID, B_ID],
    });

    expect(result.gptOut.topic).toBe("散歩");
    const persistArg = mocks.persistConversation.mock.calls[0][0];
    expect(persistArg.gptOut.topic).toBe("散歩");
  });

  it("topic_shift があっても橋渡しが無ければ topic を更新しない", async () => {
    mocks.callGptForConversation.mockResolvedValue({
      ...gptOut,
      topic: "散歩",
      meta: {
        ...gptOut.meta,
        tags: ["topic_shift"],
      },
      lines: [
        { speaker: A_ID, text: "映画の話だけど、最後の場面が印象的だった。" },
        { speaker: B_ID, text: "明日は散歩に行きたいんだ。" },
      ],
    });

    setupListKv({
      topic_threads: [
        {
          id: THREAD_ID,
          participants: [A_ID, B_ID],
          status: "ongoing",
          topic: "映画",
          updated_at: "2026-01-01T09:00:00.000Z",
          deleted: false,
        },
      ],
      relations: [
        {
          a_id: A_ID,
          b_id: B_ID,
          type: "friend",
          updated_at: "2026-01-01T09:00:00.000Z",
          deleted: false,
        },
      ],
      beliefs: [],
      presets: [],
      residents: [
        { id: A_ID, name: "遥", first_person: null, speech_preset: null, deleted: false },
        { id: B_ID, name: "湊", first_person: null, speech_preset: null, deleted: false },
      ],
      feelings: [],
      events: [],
    });

    const result = await runConversation({
      threadId: THREAD_ID,
      participants: [A_ID, B_ID],
    });

    expect(result.gptOut.topic).toBe("映画");
    const persistArg = mocks.persistConversation.mock.calls[0][0];
    expect(persistArg.gptOut.topic).toBe("映画");
  });
});
