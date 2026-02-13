import { describe, expect, it } from "vitest";
import { assessConversationGrounding } from "@/lib/conversation/grounding";
import type { ConversationBrief } from "@repo/shared/types/conversation";

const A_ID = "11111111-1111-4111-8111-111111111111";
const EXPERIENCE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeExperienceBrief(overrides?: Partial<ConversationBrief>): ConversationBrief {
  return {
    anchorExperienceId: EXPERIENCE_ID,
    anchorFact: "駅前カフェで雨宿りした",
    anchorSignature: "lifestyle:a:b:駅前カフェ:share",
    speakerAppraisal: [{ speakerId: A_ID, text: "少し気分転換になった" }],
    speakerHookIntent: [{ speakerId: A_ID, intent: "share" }],
    expressionStyle: "mixed",
    fallbackMode: "experience",
    ...overrides,
  };
}

describe("assessConversationGrounding", () => {
  it("fallbackMode が experience 以外なら常に OK を返す", () => {
    const brief = makeExperienceBrief({
      fallbackMode: "continuation",
      anchorExperienceId: undefined,
    });
    const result = assessConversationGrounding({
      brief,
      lines: [{ speaker: A_ID, text: "この前の話の続きだけど、また今度話そう。" }],
    });
    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.evidence).toEqual([]);
  });

  it("fact/appraisal/hook が揃えば接地 OK になる", () => {
    const result = assessConversationGrounding({
      brief: makeExperienceBrief(),
      lines: [
        {
          speaker: A_ID,
          text: "駅前カフェで雨宿りして、少し気分転換になった。あとで聞いてほしいんだ。",
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.evidence.some((entry) => entry.startsWith("fact:"))).toBe(true);
    expect(result.evidence.some((entry) => entry.startsWith("appraisal:"))).toBe(true);
    expect(result.evidence.some((entry) => entry.startsWith("hook:share:"))).toBe(true);
  });

  it("hookIntent の行動語が無い場合は NG になる", () => {
    const result = assessConversationGrounding({
      brief: makeExperienceBrief(),
      lines: [
        {
          speaker: A_ID,
          text: "駅前カフェで雨宿りして、少し気分転換になったよ。",
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.reasons.join("\n")).toContain("hookIntent");
  });

  it("anchorExperienceId が無い場合は NG になる", () => {
    const result = assessConversationGrounding({
      brief: makeExperienceBrief({ anchorExperienceId: undefined }),
      lines: [
        {
          speaker: A_ID,
          text: "駅前カフェで雨宿りして、少し気分転換になった。聞いてほしい。",
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.reasons.join("\n")).toContain("anchorExperienceId");
  });
});
