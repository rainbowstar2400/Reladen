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

import { callGptForSituation } from "@/lib/gpt/call-gpt-for-situation";

const baseInput = {
  characterA: { name: "A", occupation: "学生", interests: ["読書"] },
  characterB: { name: "B", occupation: "会社員", interests: ["映画"] },
  relationType: "friend",
  timeOfDay: "昼",
  date: "3月20日",
  recentSituations: [] as string[],
};

describe("callGptForSituation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("20〜30文字の出力はそのまま採用する", async () => {
    mocks.create.mockResolvedValueOnce({ output_text: "12345678901234567890" }); // 20文字

    const text = await callGptForSituation(baseInput);

    expect(text).toBe("12345678901234567890");
  });

  it("短すぎる出力はフォールバックへ切り替える", async () => {
    mocks.create.mockResolvedValueOnce({ output_text: "1234567890123456789" }); // 19文字

    const text = await callGptForSituation(baseInput);

    expect(text).not.toBe("1234567890123456789");
    expect(Array.from(text).length).toBeGreaterThanOrEqual(20);
  });

  it("長すぎる出力もフォールバックへ切り替える（31文字）", async () => {
    mocks.create.mockResolvedValueOnce({ output_text: "1234567890123456789012345678901" }); // 31文字

    const text = await callGptForSituation(baseInput);

    expect(text).not.toBe("1234567890123456789012345678901");
    expect(Array.from(text).length).toBeGreaterThanOrEqual(20);
  });

  it("recentSituations をプロンプトへ渡し、重複候補を避けてフォールバックする", async () => {
    const usedSituations = [
      "夕暮れの帰り道、角を曲がった先でばったり会った",
      "昼休みの廊下で同時に足を止め、目が合った",
      "雨宿りの軒先で並んだ瞬間、互いに気づいた",
      "本棚の前で同じ本に手を伸ばし、顔を見合わせた",
    ];
    mocks.create.mockResolvedValueOnce({ output_text: "short" });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    const text = await callGptForSituation({
      ...baseInput,
      recentSituations: usedSituations,
    });
    randomSpy.mockRestore();

    const requestArg = mocks.create.mock.calls[0]?.[0];
    const userText = requestArg?.input?.[1]?.content?.[0]?.text ?? "";

    expect(userText).toContain("- 夕暮れの帰り道、角を曲がった先でばったり会った");
    expect(userText).toContain("- 本棚の前で同じ本に手を伸ばし、顔を見合わせた");
    expect(text).toBe("駅前の信号待ちで隣に立ち、自然に会話が始まった");
  });
});

