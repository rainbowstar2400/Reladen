import { describe, expect, it, vi } from "vitest";
import {
  buildConversationStructure,
  determineStance,
  TOPIC_INTEREST_FAVOR_ATTENUATION,
} from "@repo/shared/logic/conversation-structure";

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

  it("話題非関心時の favor 減衰率は 0.5 の定数で適用される", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);

    const stance = determineStance(
      {
        id: A_ID,
        name: "A",
        traits: { sociability: 3, expressiveness: 3, empathy: 4, stubbornness: 3, activity: 3 },
        interests: [],
      },
      false,
      {
        type: "friend",
        feelingAtoB: { label: "like", score: 90 },
        feelingBtoA: { label: "like", score: 90 },
      },
      {
        source: "third_party",
        label: "Cの近況",
        detail: "第三者の最近の出来事",
        thirdPartyContext: {
          characterName: "C",
          knownFacts: ["最近忙しい"],
          listenerKnowsCharacter: true,
        },
      },
      false,
      90,
    );

    randomSpy.mockRestore();

    expect(TOPIC_INTEREST_FAVOR_ATTENUATION).toBe(0.5);
    expect(stance).toBe("indifferent");
  });

  it("snippet 話題は高関心扱いで受け手スタンスが受動化しにくい", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);

    const structure = buildConversationStructure({
      characterA: {
        id: A_ID,
        name: "A",
        traits: { sociability: 4, expressiveness: 4, empathy: 4, stubbornness: 2, activity: 3 },
        interests: ["料理"],
      },
      characterB: {
        id: B_ID,
        name: "B",
        traits: { sociability: 4, expressiveness: 4, empathy: 4, stubbornness: 2, activity: 3 },
        interests: ["料理"],
      },
      relation: {
        type: "friend",
        feelingAtoB: { label: "like", score: 70 },
        feelingBtoA: { label: "like", score: 70 },
      },
      topic: {
        source: "snippet",
        label: "共有した出来事",
        detail: "共有体験",
      },
      initiatorOverrideId: A_ID,
    });

    randomSpy.mockRestore();

    expect(structure.initiatorStance).not.toBe("indifferent");
    expect(structure.responderStance).not.toBe("indifferent");
    expect(structure.responderStance).not.toBe("reluctant");
  });
});

