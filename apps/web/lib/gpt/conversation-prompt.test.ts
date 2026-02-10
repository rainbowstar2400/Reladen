import { describe, expect, it } from "vitest";
import { buildUserPromptConversation } from "@repo/shared/gpt/prompts/conversation-prompt";
import type { BeliefRecord } from "@repo/shared/types/conversation";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";

function makeBeliefFor(
  residentId: string,
  otherId: string,
  keys: string[],
): BeliefRecord {
  return {
    id: residentId === A_ID
      ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      : "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    residentId,
    worldFacts: [],
    personKnowledge: {
      [otherId]: {
        keys,
        learnedAt: "2026-01-01T09:00:00.000Z",
      },
    },
    updated_at: "2026-01-01T09:00:00.000Z",
    deleted: false,
  };
}

describe("buildUserPromptConversation", () => {
  it("関係性・感情・直近台詞を含み、Belief生JSONを出さず品質ルールを含む", () => {
    const prompt = buildUserPromptConversation({
      thread: {
        id: "33333333-3333-4333-8333-333333333333",
        participants: [A_ID, B_ID],
        status: "ongoing",
        topic: "週末の予定",
        updated_at: "2026-01-01T09:00:00.000Z",
        deleted: false,
      },
      beliefs: {
        [A_ID]: makeBeliefFor(A_ID, B_ID, [
          "memory-old",
          "memory-two",
          "memory-three",
          "memory-four",
        ]),
        [B_ID]: makeBeliefFor(B_ID, A_ID, []),
      },
      residents: {
        [A_ID]: {
          id: A_ID,
          name: "遥",
          firstPerson: "私",
          speechPreset: "丁寧",
          speechPresetDescription: "やわらかい敬語で話す",
          speechExample: "私はそう思います。",
        },
        [B_ID]: {
          id: B_ID,
          name: "湊",
          firstPerson: "俺",
          speechPreset: "砕けた",
          speechPresetDescription: "短く率直に話す",
          speechExample: "俺はそれでいい。",
        },
      },
      pairContext: {
        relationType: "friend",
        feelings: {
          aToB: { label: "maybe_like", score: 64 },
          bToA: { label: "curious", score: 51 },
        },
        recentLines: [
          { speaker: A_ID, text: "古い発話" },
          { speaker: B_ID, text: "最近の発話1" },
          { speaker: A_ID, text: "最近の発話2" },
          { speaker: B_ID, text: "最近の発話3" },
          { speaker: A_ID, text: "最近の発話4" },
        ],
      },
      lastSummary: "昨日は映画の話題で盛り上がった。",
    });

    expect(prompt).toContain("【2人の関係性と現在の感情】");
    expect(prompt).toContain("関係性: 友人");
    expect(prompt).toContain("遥→湊: 感情=好きかも / スコア=64");
    expect(prompt).toContain("湊→遥: 感情=気になる / スコア=51");

    expect(prompt).toContain("【直近の会話抜粋（最大4発話）】");
    expect(prompt).not.toContain("古い発話");
    expect(prompt).toContain("最近の発話1");
    expect(prompt).toContain("最近の発話4");

    expect(prompt).not.toContain("Belief = {");
    expect(prompt).not.toContain("memory old");
    expect(prompt).toContain("memory two");
    expect(prompt).toContain("memory three");
    expect(prompt).toContain("memory four");
    expect(prompt).toContain("特筆なし");

    expect(prompt).toContain("発話数は6〜8発話");
    expect(prompt).toContain("一人称は「私」を厳守すること。");
    expect(prompt).toContain("一人称は「俺」を厳守すること。");
  });
});
