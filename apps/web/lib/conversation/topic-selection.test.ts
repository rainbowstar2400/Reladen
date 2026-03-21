import { describe, expect, it, vi } from "vitest";
import {
  selectTopic,
  SMALL_TALK_CATEGORY_DETAIL,
  SMALL_TALK_CATEGORY_LABEL,
  TOPIC_SCORE_RULES,
  type TopicSelectionInput,
} from "@repo/shared/logic/topic-selection";
import type { TopicCandidate, TopicSource } from "@repo/shared/types/conversation-generation";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";
const C_ID = "33333333-3333-4333-8333-333333333333";

const SNIPPET_ID = "44444444-4444-4444-8444-444444444444";
const KNOWLEDGE_ID = "55555555-5555-4555-8555-555555555555";
const EVENT_ID = "66666666-6666-4666-8666-666666666666";

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

function createScoringInput(
  relationType: TopicSelectionInput["relation"]["type"],
  recentTopics: string[] = [],
): TopicSelectionInput {
  return createInput({
    characterA: {
      id: A_ID,
      name: "A",
      traits: { sociability: 4, empathy: 3, stubbornness: 3, activity: 3, expressiveness: 3 },
      interests: ["共通趣味", "Aだけの趣味"],
    },
    characterB: {
      id: B_ID,
      name: "B",
      traits: { sociability: 3, empathy: 3, stubbornness: 3, activity: 3, expressiveness: 3 },
      interests: ["共通趣味", "Bだけの趣味"],
    },
    relation: {
      type: relationType,
      feelingAtoB: { label: "none", score: 30 },
      feelingBtoA: { label: "none", score: 30 },
    },
    previousMemory: {
      summary: "前回の会話",
      topicsCovered: ["共通趣味"],
      unresolvedThreads: ["未解決の続き話題"],
      knowledgeGained: [],
    },
    recentSnippets: [
      {
        id: SNIPPET_ID,
        participants: [A_ID, B_ID],
        text: "共有スニペット話題",
        occurredAt: "2026-03-20T10:00:00.000Z",
        source: "routine",
      },
    ],
    knowledgeByA: [
      {
        id: KNOWLEDGE_ID,
        learnedBy: A_ID,
        about: C_ID,
        fact: "Cは最近忙しい",
        source: "offscreen",
        learnedAt: "2026-03-20T09:00:00.000Z",
      },
    ],
    knowledgeByB: [],
    recentEventsA: [
      {
        id: EVENT_ID,
        characterId: A_ID,
        fact: "Aの最近の出来事",
        generatedAt: "2026-03-20T11:00:00.000Z",
        sharedWith: [],
      },
    ],
    nameMap: new Map([[C_ID, "C"]]),
    recentTopics,
  });
}

function pickCandidateBySource(candidates: TopicCandidate[], source: TopicSource): TopicCandidate {
  const found = candidates.find((candidate) => candidate.source === source);
  expect(found).toBeDefined();
  return found!;
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

describe("topic-selection scoring rules", () => {
  it("source ごとのスコアルールをテーブルで定義している", () => {
    expect(Object.keys(TOPIC_SCORE_RULES).sort()).toEqual([
      "continuation",
      "heart_to_heart",
      "personal_interest",
      "seasonal",
      "self_experience",
      "shared_interest",
      "small_talk",
      "snippet",
      "third_party",
    ]);
  });

  it("低親密度(acquaintance)時の各 source スコア境界値を維持する", () => {
    const input = createScoringInput("acquaintance");
    const result = selectTopic(input, input.characterA, input.characterB);

    expect(pickCandidateBySource(result.candidates, "shared_interest").score).toBeCloseTo(6.5);
    expect(pickCandidateBySource(result.candidates, "personal_interest").score).toBeCloseTo(3.3);
    expect(pickCandidateBySource(result.candidates, "continuation").score).toBeCloseTo(7.3);
    expect(pickCandidateBySource(result.candidates, "snippet").score).toBeCloseTo(5.4);
    expect(pickCandidateBySource(result.candidates, "third_party").score).toBeCloseTo(1.0);
    expect(pickCandidateBySource(result.candidates, "self_experience").score).toBeCloseTo(4.4);
    expect(pickCandidateBySource(result.candidates, "heart_to_heart").score).toBe(0);
    expect(pickCandidateBySource(result.candidates, "small_talk").score).toBe(3);
    expect(pickCandidateBySource(result.candidates, "seasonal").score).toBe(2);
  });

  it("高親密度(lover)時の各 source スコア境界値を維持する", () => {
    const input = createScoringInput("lover");
    const result = selectTopic(input, input.characterA, input.characterB);

    expect(pickCandidateBySource(result.candidates, "shared_interest").score).toBeCloseTo(8.5);
    expect(pickCandidateBySource(result.candidates, "personal_interest").score).toBeCloseTo(6.5);
    expect(pickCandidateBySource(result.candidates, "continuation").score).toBeCloseTo(8.5);
    expect(pickCandidateBySource(result.candidates, "snippet").score).toBeCloseTo(7.0);
    expect(pickCandidateBySource(result.candidates, "third_party").score).toBeCloseTo(7.2);
    expect(pickCandidateBySource(result.candidates, "self_experience").score).toBeCloseTo(6.0);
    expect(pickCandidateBySource(result.candidates, "heart_to_heart").score).toBeCloseTo(6.0);
    expect(pickCandidateBySource(result.candidates, "small_talk").score).toBe(3);
    expect(pickCandidateBySource(result.candidates, "seasonal").score).toBe(2);
  });

  it("鮮度ペナルティは最近話題一致時のみ -3 を適用する", () => {
    const input = createScoringInput("lover", ["Aだけの趣味", "共有スニペット話題"]);
    const result = selectTopic(input, input.characterA, input.characterB);

    expect(pickCandidateBySource(result.candidates, "personal_interest").score).toBeCloseTo(3.5);
    expect(pickCandidateBySource(result.candidates, "snippet").score).toBeCloseTo(4.0);
    expect(pickCandidateBySource(result.candidates, "continuation").score).toBeCloseTo(8.5);
  });
});
