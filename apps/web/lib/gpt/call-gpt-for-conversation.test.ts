import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("@/env", () => ({
  env: {
    OPENAI_API_KEY: "test-key",
  },
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    responses = {
      create: mocks.create,
    };
  },
}));

import {
  callGptForConversation,
  assessTopicContinuity,
  containsBridgePhrase,
} from "@/lib/gpt/call-gpt-for-conversation";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";
const THREAD_ID = "33333333-3333-4333-8333-333333333333";

function makeResponse(payload: unknown) {
  return {
    output_text: [JSON.stringify(payload)],
  };
}

function makePayload(input: {
  topic: string;
  lines: Array<{ speaker: string; text: string }>;
  tags?: string[];
}) {
  return {
    threadId: THREAD_ID,
    participants: [A_ID, B_ID],
    topic: input.topic,
    lines: input.lines,
    meta: {
      tags: input.tags ?? [],
      newKnowledge: [],
      signals: ["continue"],
      qualityHints: {
        turnBalance: "balanced",
        tone: "neutral",
      },
      debug: [],
    },
  };
}

const baseParams = {
  thread: {
    id: THREAD_ID,
    participants: [A_ID, B_ID] as [string, string],
    status: "ongoing" as const,
    updated_at: "2026-02-01T00:00:00.000Z",
    deleted: false,
    topic: "映画",
  },
  beliefs: {},
  residents: {
    [A_ID]: { id: A_ID, name: "遥", firstPerson: "私" },
    [B_ID]: { id: B_ID, name: "湊", firstPerson: "俺" },
  },
  pairContext: {
    recentLines: [{ speaker: A_ID, text: "映画の話の続きだけど、主演がよかったね。" }],
  },
};

describe("callGptForConversation continuity gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("初回失敗時は1回だけ再生成する", async () => {
    mocks.create
      .mockResolvedValueOnce(
        makeResponse(
          makePayload({
            topic: "映画",
            lines: [
              { speaker: A_ID, text: "今日はお腹がすいた。" },
              { speaker: B_ID, text: "猫の動画を見たい。" },
            ],
            tags: [],
          }),
        ),
      )
      .mockResolvedValueOnce(
        makeResponse(
          makePayload({
            topic: "映画",
            lines: [
              { speaker: A_ID, text: "映画の話の続きだけど、あの場面が印象的だった。" },
              { speaker: B_ID, text: "ところで映画の余韻もあるし、次は散歩の話をしてもいい？" },
            ],
            tags: ["topic_shift"],
          }),
        ),
      );

    const out = await callGptForConversation(baseParams);

    expect(out.topic).toBe("映画");
    expect(mocks.create).toHaveBeenCalledTimes(2);
    const retryPrompt = mocks.create.mock.calls[1][0]?.input?.[1]?.content?.[0]?.text;
    expect(typeof retryPrompt).toBe("string");
    expect(String(retryPrompt)).toContain("【再生成指示】");
  });

  it("初回成功時は再生成しない", async () => {
    mocks.create.mockResolvedValueOnce(
      makeResponse(
        makePayload({
          topic: "映画",
          lines: [
            { speaker: A_ID, text: "映画の話の続きだけど、音楽が良かったよね。" },
            { speaker: B_ID, text: "映画の話の続きで、雰囲気にもすごく合ってた。" },
          ],
          tags: [],
        }),
      ),
    );

    const out = await callGptForConversation(baseParams);
    expect(out.topic).toBe("映画");
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
});

describe("topic continuity helpers", () => {
  it("topic_shift + 橋渡しがあれば低連続性でも通過する", () => {
    const res = assessTopicContinuity({
      topic: "映画",
      lines: [
        { speaker: A_ID, text: "映画について話したい。主演がよかった。" },
        { speaker: B_ID, text: "ところで明日の予定も確認したい。" },
      ],
      tags: ["topic_shift"],
      recentLines: [{ speaker: A_ID, text: "映画について話したい。" }],
    });
    expect(res.ok).toBe(true);
  });

  it("topic_shift が無い低連続性ターンは失敗する", () => {
    const res = assessTopicContinuity({
      topic: "映画",
      lines: [
        { speaker: A_ID, text: "映画の話なんだけど、主演がよかった。" },
        { speaker: B_ID, text: "明日は猫カフェに行く。" },
      ],
      tags: [],
      recentLines: [{ speaker: A_ID, text: "映画について話したい。" }],
    });
    expect(res.ok).toBe(false);
    expect(res.reasons.join("\n")).toContain("topic_shift");
  });

  it("橋渡し語判定が働く", () => {
    expect(containsBridgePhrase("ところで、次の話だけど。")).toBe(true);
    expect(containsBridgePhrase("映画の話を続けよう。")).toBe(false);
  });
});
