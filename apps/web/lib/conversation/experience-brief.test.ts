import { describe, expect, it } from "vitest";
import { buildConversationBrief } from "@/lib/conversation/experience-brief";
import type { ExperienceEvent, ResidentExperience } from "@repo/shared/types/conversation";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";
const E1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const E2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeEvent(input: {
  id: string;
  factSummary: string;
  significance: number;
  signature: string;
  occurredAt?: string;
}): ExperienceEvent {
  return {
    id: input.id,
    ownerId: null,
    sourceType: "lifestyle",
    sourceRef: null,
    factSummary: input.factSummary,
    factDetail: null,
    tags: ["test"],
    significance: input.significance,
    signature: input.signature,
    occurredAt: input.occurredAt ?? "2026-02-13T00:00:00.000Z",
    updated_at: "2026-02-13T00:00:00.000Z",
    deleted: false,
  };
}

function makeResidentExperience(input: {
  id: string;
  experienceId: string;
  residentId: string;
  appraisal: string;
  hookIntent: ResidentExperience["hookIntent"];
  salience: number;
  confidence: number;
}): ResidentExperience {
  return {
    id: input.id,
    ownerId: null,
    experienceId: input.experienceId,
    residentId: input.residentId,
    awareness: "direct",
    appraisal: input.appraisal,
    hookIntent: input.hookIntent,
    confidence: input.confidence,
    salience: input.salience,
    learnedAt: "2026-02-13T00:00:00.000Z",
    expiresAt: null,
    updated_at: "2026-02-13T00:00:00.000Z",
    deleted: false,
  };
}

describe("buildConversationBrief", () => {
  it("Fact + Appraisal + Hook が揃った候補をアンカー採用する", () => {
    const brief = buildConversationBrief({
      participants: [A_ID, B_ID],
      nowIso: "2026-02-13T03:00:00.000Z",
      hasRecentConversation: true,
      recentAnchorSignatures: ["lifestyle:a:b:home:share"],
      experienceEvents: [
        makeEvent({
          id: E1,
          factSummary: "遊園地に行った",
          significance: 72,
          signature: "lifestyle:a:b:park:invite",
        }),
      ],
      residentExperiences: [
        makeResidentExperience({
          id: "c1",
          experienceId: E1,
          residentId: A_ID,
          appraisal: "思ったより楽しかった",
          hookIntent: "invite",
          salience: 90,
          confidence: 85,
        }),
        makeResidentExperience({
          id: "c2",
          experienceId: E1,
          residentId: B_ID,
          appraisal: "また行きたい",
          hookIntent: "share",
          salience: 80,
          confidence: 75,
        }),
      ],
    });

    expect(brief.fallbackMode).toBe("experience");
    expect(brief.anchorExperienceId).toBe(E1);
    expect(brief.anchorFact).toContain("遊園地");
    expect(brief.speakerAppraisal).toHaveLength(2);
    expect(brief.speakerHookIntent.map((entry) => entry.intent)).toEqual(["invite", "share"]);
  });

  it("有効候補が無い場合は continuation にフォールバックする", () => {
    const brief = buildConversationBrief({
      participants: [A_ID, B_ID],
      nowIso: "2026-02-13T03:00:00.000Z",
      hasRecentConversation: true,
      experienceEvents: [
        makeEvent({
          id: E2,
          factSummary: "散歩した",
          significance: 40,
          signature: "lifestyle:a:b:street:reflect",
        }),
      ],
      residentExperiences: [
        makeResidentExperience({
          id: "d1",
          experienceId: E2,
          residentId: A_ID,
          appraisal: "",
          hookIntent: "reflect",
          salience: 20,
          confidence: 20,
        }),
      ],
    });

    expect(brief.fallbackMode).toBe("continuation");
    expect(brief.anchorExperienceId).toBeUndefined();
  });
});
