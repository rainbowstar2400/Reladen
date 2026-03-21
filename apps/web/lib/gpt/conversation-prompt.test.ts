import { describe, expect, it } from "vitest";
import {
  buildUserPrompt,
  systemPromptConversation,
} from "@repo/shared/gpt/prompts/conversation-prompt";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";

describe("conversation-prompt", () => {
  it("system prompt に 20〜30文字目安 / 40文字上限の指示を含む", () => {
    expect(systemPromptConversation).toContain("20〜30文字");
    expect(systemPromptConversation).toContain("40文字");
  });

  it("user prompt に定量指示とシチュエーション設定を含む", () => {
    const prompt = buildUserPrompt({
      characters: [
        {
          id: A_ID,
          name: "A",
          traits: {},
          interests: ["料理"],
        },
        {
          id: B_ID,
          name: "B",
          traits: {},
          interests: ["映画"],
        },
      ],
      relation: {
        type: "friend",
        feelingAtoB: { label: "curious", score: 40 },
        feelingBtoA: { label: "maybe_like", score: 55 },
      },
      structure: {
        initiatorId: A_ID,
        initiatorName: "A",
        responderId: B_ID,
        responderName: "B",
        initiatorStance: "agreeable",
        responderStance: "agreeable",
        temperature: "neutral",
        initiatorTurnLength: "1文",
        responderTurnLength: "1文",
      },
      topic: {
        source: "small_talk",
        label: "雑談",
        detail: "日常の一言",
      },
      environment: { timeOfDay: "昼", weather: "晴れ" },
      gameDate: "3月20日",
      recentSnippets: [],
      previousMemory: null,
      threadId: "33333333-3333-4333-8333-333333333333",
      situation: "昼休みの廊下で同時に足を止め、目が合った",
    });

    expect(prompt).toContain("1発話は20〜30文字を目安にし、40文字を超えない");
    expect(prompt).toContain("話題が一段落したら、余韻を残しつつ自然に会話を締めること");
    expect(prompt).toContain("シチュエーション: 昼休みの廊下で同時に足を止め、目が合った");
  });
});

