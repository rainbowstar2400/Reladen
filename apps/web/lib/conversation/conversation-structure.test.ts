import { describe, expect, it, vi } from "vitest";
import { buildConversationStructure } from "@repo/shared/logic/conversation-structure";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";

describe("conversation-structure (third_party)", () => {
  it("third_party 話題は低関心扱いになり、スタンスを過度に上げない", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);

    const structure = buildConversationStructure({
      characterA: {
        id: A_ID,
        name: "A",
        traits: { sociability: 1, expressiveness: 1, empathy: 3, stubbornness: 3, activity: 2 },
        interests: ["料理"],
      },
      characterB: {
        id: B_ID,
        name: "B",
        traits: { sociability: 1, expressiveness: 1, empathy: 3, stubbornness: 3, activity: 2 },
        interests: ["料理"],
      },
      relation: {
        type: "friend",
        feelingAtoB: { label: "like", score: 60 },
        feelingBtoA: { label: "like", score: 60 },
      },
      topic: {
        source: "third_party",
        label: "友人の近況",
        detail: "第三者の最近の出来事",
        thirdPartyContext: {
          characterName: "C",
          knownFacts: ["最近忙しいらしい"],
          listenerKnowsCharacter: true,
        },
      },
      initiatorOverrideId: A_ID,
    });

    randomSpy.mockRestore();
    expect(structure.initiatorStance).toBe("indifferent");
    expect(structure.responderStance).toBe("indifferent");
  });
});

