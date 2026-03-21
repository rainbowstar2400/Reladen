import { describe, expect, it } from "vitest";
import {
  buildRetryFeedback,
  validateConversationOutput,
} from "@repo/shared/logic/conversation-validator";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";

function createOutput(params: {
  turnCount: number;
  aText: string;
  bText: string;
  summary?: string;
  unresolvedThreads?: string[];
}) {
  return {
    threadId: "33333333-3333-4333-8333-333333333333",
    participants: [A_ID, B_ID] as [string, string],
    topic: "テスト話題",
    lines: Array.from({ length: params.turnCount }).map((_, index) => ({
      speaker: index % 2 === 0 ? A_ID : B_ID,
      text: index % 2 === 0 ? params.aText : params.bText,
    })),
    meta: {
      tags: ["test"],
      qualityHints: { turnBalance: "balanced" as const, tone: "neutral" },
      debug: [],
      memory: {
        summary: params.summary ?? "会話した",
        topicsCovered: ["テスト話題"],
        unresolvedThreads: params.unresolvedThreads ?? [],
        knowledgeGained: [],
      },
    },
  };
}

function baseStructure(overrides?: Partial<{
  initiatorStance: "enthusiastic" | "agreeable" | "reluctant" | "indifferent" | "confrontational";
  responderStance: "enthusiastic" | "agreeable" | "reluctant" | "indifferent" | "confrontational";
}>) {
  return {
    initiatorId: A_ID,
    initiatorName: "A",
    responderId: B_ID,
    responderName: "B",
    initiatorStance: overrides?.initiatorStance ?? "agreeable",
    responderStance: overrides?.responderStance ?? "agreeable",
    temperature: "neutral" as const,
    initiatorTurnLength: "1文",
    responderTurnLength: "1文",
  };
}

describe("conversation-validator", () => {
  it("turn_count は 11 で警告、12 で非違反", () => {
    const result11 = validateConversationOutput({
      output: createOutput({ turnCount: 11, aText: "a".repeat(20), bText: "b".repeat(20) }),
      structure: baseStructure(),
      firstPersonMap: {},
    });
    const result12 = validateConversationOutput({
      output: createOutput({ turnCount: 12, aText: "a".repeat(20), bText: "b".repeat(20) }),
      structure: baseStructure(),
      firstPersonMap: {},
    });

    expect(result11.violations.some((v) => v.rule === "turn_count")).toBe(true);
    expect(result12.violations.some((v) => v.rule === "turn_count")).toBe(false);
  });

  it("indifferent の平均文字数は 30 で許容、31 で警告", () => {
    const result30 = validateConversationOutput({
      output: createOutput({ turnCount: 12, aText: "a".repeat(30), bText: "b".repeat(20) }),
      structure: baseStructure({ initiatorStance: "indifferent" }),
      firstPersonMap: {},
    });
    const result31 = validateConversationOutput({
      output: createOutput({ turnCount: 12, aText: "a".repeat(31), bText: "b".repeat(20) }),
      structure: baseStructure({ initiatorStance: "indifferent" }),
      firstPersonMap: {},
    });

    expect(result30.violations.some((v) => v.rule === "heuristic_indifferent_long")).toBe(false);
    expect(result31.violations.some((v) => v.rule === "heuristic_indifferent_long")).toBe(true);
  });

  it("1発話の長さは 40 で許容、41 で heuristic_over_length 警告", () => {
    const result40 = validateConversationOutput({
      output: createOutput({ turnCount: 12, aText: "a".repeat(40), bText: "b".repeat(20) }),
      structure: baseStructure(),
      firstPersonMap: {},
    });
    const result41 = validateConversationOutput({
      output: createOutput({ turnCount: 12, aText: "a".repeat(41), bText: "b".repeat(20) }),
      structure: baseStructure(),
      firstPersonMap: {},
    });

    expect(result40.violations.some((v) => v.rule === "heuristic_over_length")).toBe(false);
    expect(result41.violations.some((v) => v.rule === "heuristic_over_length")).toBe(true);
  });

  it("promise_generation では unresolvedThreads が空だと error になる", () => {
    const result = validateConversationOutput({
      output: createOutput({
        turnCount: 12,
        aText: "a".repeat(20),
        bText: "b".repeat(20),
        unresolvedThreads: [],
      }),
      structure: baseStructure(),
      firstPersonMap: {},
      conversationType: "promise_generation",
    });

    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.rule === "memory_unresolved_threads" && v.severity === "error")).toBe(true);
  });

  it("normal では unresolvedThreads が空でも専用ルールは発火しない", () => {
    const result = validateConversationOutput({
      output: createOutput({
        turnCount: 12,
        aText: "a".repeat(20),
        bText: "b".repeat(20),
        unresolvedThreads: [],
      }),
      structure: baseStructure(),
      firstPersonMap: {},
      conversationType: "normal",
    });

    expect(result.violations.some((v) => v.rule === "memory_unresolved_threads")).toBe(false);
  });

  it("summary が空でも validation が実行され memory_summary error になる", () => {
    const result = validateConversationOutput({
      output: createOutput({
        turnCount: 12,
        aText: "a".repeat(20),
        bText: "b".repeat(20),
        summary: "",
      }),
      structure: baseStructure(),
      firstPersonMap: {},
      conversationType: "normal",
    });

    expect(result.violations.some((v) => v.rule === "memory_summary" && v.severity === "error")).toBe(true);
  });

  it("buildRetryFeedback は error/warning を区別して返す", () => {
    const feedback = buildRetryFeedback({
      valid: false,
      violations: [
        { rule: "initiator_first", message: "主導者が先頭でない", severity: "error" },
        { rule: "heuristic_over_length", message: "発話が長すぎる", severity: "warning" },
      ],
    });

    expect(feedback).toContain("[必須修正] 主導者が先頭でない");
    expect(feedback).toContain("[推奨修正] 発話が長すぎる");
  });
});

