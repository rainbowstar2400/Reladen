import { describe, expect, it, vi } from "vitest";
import {
  selectTopic,
  SMALL_TALK_CATEGORY_DETAIL,
  SMALL_TALK_CATEGORY_LABEL,
  type TopicSelectionInput,
} from "@repo/shared/logic/topic-selection";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";

function createInput(
  overrides: Partial<TopicSelectionInput> = {},
): TopicSelectionInput {
  return {
    characterA: {
      id: A_ID,
      name: "A",
      traits: { sociability: 3, empathy: 3, stubbornness: 3, activity: 3, expressiveness: 3 },
      interests: [],
    },
    characterB: {
      id: B_ID,
      name: "B",
      traits: { sociability: 3, empathy: 3, stubbornness: 3, activity: 3, expressiveness: 3 },
      interests: [],
    },
    relation: {
      type: "acquaintance",
      feelingAtoB: { label: "none", score: 30 },
      feelingBtoA: { label: "none", score: 30 },
    },
    previousMemory: null,
    recentSnippets: [],
    knowledgeByA: [],
    knowledgeByB: [],
    recentTopics: [],
    environment: { timeOfDay: "昼", weather: "sunny" },
    situation: "廊下ですれ違った",
    currentDate: "2026-03-20",
    ...overrides,
  };
}

describe("topic-selection (small_talk)", () => {
  it("small_talk の候補ラベルは時間帯・天候・シチュエーションに依存せず固定", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    const morning = createInput({
      environment: { timeOfDay: "朝", weather: "sunny" },
      situation: "朝の挨拶を交わした",
    });
    const night = createInput({
      environment: { timeOfDay: "夜", weather: "rain" },
      situation: "駅前で偶然会った",
    });

    const morningResult = selectTopic(morning, morning.characterA, morning.characterB);
    const nightResult = selectTopic(night, night.characterA, night.characterB);

    randomSpy.mockRestore();

    const morningSmallTalk = morningResult.candidates.filter((candidate) => candidate.source === "small_talk");
    const nightSmallTalk = nightResult.candidates.filter((candidate) => candidate.source === "small_talk");

    expect(morningSmallTalk).toHaveLength(1);
    expect(nightSmallTalk).toHaveLength(1);
    expect(morningSmallTalk[0]).toMatchObject({
      label: SMALL_TALK_CATEGORY_LABEL,
      detail: SMALL_TALK_CATEGORY_DETAIL,
    });
    expect(nightSmallTalk[0]).toMatchObject({
      label: SMALL_TALK_CATEGORY_LABEL,
      detail: SMALL_TALK_CATEGORY_DETAIL,
    });
  });

  it("フォールバックでも small_talk はカテゴリ固定で返す", () => {
    const input = createInput({
      relation: {
        type: "none",
        feelingAtoB: { label: "none", score: 30 },
        feelingBtoA: { label: "none", score: 30 },
      },
      currentDate: "2026-03-20",
      recentTopics: [SMALL_TALK_CATEGORY_LABEL, "春の話題"],
    });

    const result = selectTopic(input, input.characterA, input.characterB);

    expect(result.selected).toEqual({
      source: "small_talk",
      label: SMALL_TALK_CATEGORY_LABEL,
      detail: SMALL_TALK_CATEGORY_DETAIL,
    });
  });
});
