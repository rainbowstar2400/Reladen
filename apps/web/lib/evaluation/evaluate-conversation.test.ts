import { beforeEach, describe, expect, it } from "vitest";
import { evaluateConversation } from "@/lib/evaluation/evaluate-conversation";
import { __setWeightsForTests__, getWeightsCached, type WeightsConfig } from "@/lib/evaluation/weights";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";

function cloneWeights(weights: WeightsConfig): WeightsConfig {
  return {
    tags: { ...weights.tags },
    qualityHints: { ...weights.qualityHints },
    favorClip: { ...weights.favorClip },
  };
}

function createBaseInput() {
  return {
    threadId: "33333333-3333-4333-8333-333333333333",
    participants: [A_ID, B_ID] as [string, string],
    lines: [] as Array<{ speaker: string; text: string }>,
    meta: {
      tags: [] as string[],
      qualityHints: {} as Record<string, unknown>,
    },
    promiseFlag: false,
  };
}

describe("evaluate-conversation weights integration", () => {
  const initialWeights = cloneWeights(getWeightsCached());

  beforeEach(() => {
    __setWeightsForTests__(cloneWeights(initialWeights));
  });

  it("__setWeightsForTests__ で差し替えた tag 重みが favor に反映される", () => {
    __setWeightsForTests__({
      tags: { "共感": 3.4 },
      qualityHints: {},
      favorClip: { min: -10, max: 10 },
    });

    const input = createBaseInput();
    input.meta.tags = ["共感"];

    const result = evaluateConversation(input);

    expect(result.deltas.aToB.favor).toBe(4);
    expect(result.deltas.bToA.favor).toBe(4);
  });

  it("__setWeightsForTests__ で差し替えた qualityHints 重みが favor に反映される", () => {
    __setWeightsForTests__({
      tags: {},
      qualityHints: { "tone.harsh": -2.8 },
      favorClip: { min: -10, max: 10 },
    });

    const input = createBaseInput();
    input.meta.qualityHints = { "tone.harsh": true };

    const result = evaluateConversation(input);

    expect(result.deltas.aToB.favor).toBe(-3);
    expect(result.deltas.bToA.favor).toBe(-3);
  });

  it("favorClip も JSON 重み設定を使用する", () => {
    __setWeightsForTests__({
      tags: { "共感": 9.0 },
      qualityHints: {},
      favorClip: { min: -1, max: 1 },
    });

    const input = createBaseInput();
    input.meta.tags = ["共感"];

    const result = evaluateConversation(input);

    expect(result.deltas.aToB.favor).toBe(1);
    expect(result.deltas.bToA.favor).toBe(1);
  });
});
