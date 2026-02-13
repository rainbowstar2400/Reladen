import type {
  ConversationBrief,
  ConversationExpressionStyle,
  ExperienceEvent,
  HookIntent,
  ResidentExperience,
} from "@repo/shared/types/conversation";

type ResidentExperienceRow = Record<string, unknown>;
type ExperienceEventRow = Record<string, unknown>;

const HOOK_INTENTS: HookIntent[] = ["invite", "share", "complain", "consult", "reflect"];

function clampToScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseIsoMillis(input: string | null | undefined): number {
  if (!input) return 0;
  const ts = Date.parse(input);
  return Number.isFinite(ts) ? ts : 0;
}

function toSourceType(raw: unknown): ExperienceEvent["sourceType"] | null {
  if (raw === "lifestyle" || raw === "work" || raw === "interpersonal" || raw === "environment") {
    return raw;
  }
  return null;
}

function toAwareness(raw: unknown): ResidentExperience["awareness"] | null {
  if (raw === "direct" || raw === "witnessed" || raw === "heard") return raw;
  return null;
}

function toHookIntent(raw: unknown): HookIntent | null {
  if (typeof raw !== "string") return null;
  return HOOK_INTENTS.includes(raw as HookIntent) ? (raw as HookIntent) : null;
}

function pickStringField(input: Record<string, unknown>, key: string, snake: string): string | undefined {
  const camel = input[key];
  if (typeof camel === "string" && camel.trim().length > 0) return camel;
  const snakeValue = input[snake];
  if (typeof snakeValue === "string" && snakeValue.trim().length > 0) return snakeValue;
  return undefined;
}

function isDeletedRow(input: Record<string, unknown>): boolean {
  return Boolean(input.deleted);
}

export function parseExperienceEventRow(row: ExperienceEventRow): ExperienceEvent | null {
  if (!row || isDeletedRow(row)) return null;
  const id = pickStringField(row, "id", "id");
  const sourceType = toSourceType(pickStringField(row, "sourceType", "source_type"));
  const factSummary = pickStringField(row, "factSummary", "fact_summary");
  const signature = pickStringField(row, "signature", "signature");
  const occurredAt = pickStringField(row, "occurredAt", "occurred_at");
  const updatedAt = pickStringField(row, "updated_at", "updated_at");
  if (!id || !sourceType || !factSummary || !signature || !occurredAt || !updatedAt) return null;

  const ownerId = pickStringField(row, "ownerId", "owner_id") ?? null;
  const sourceRef = pickStringField(row, "sourceRef", "source_ref") ?? null;
  const tagsRaw = row.tags;
  const tags = Array.isArray(tagsRaw)
    ? tagsRaw.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
  const significanceRaw = row.significance;
  const significance = clampToScore(
    typeof significanceRaw === "number" ? significanceRaw : Number(significanceRaw),
  );

  return {
    id,
    ownerId,
    sourceType,
    sourceRef,
    factSummary,
    factDetail: (row.factDetail as Record<string, unknown> | null | undefined)
      ?? (row.fact_detail as Record<string, unknown> | null | undefined)
      ?? null,
    tags,
    significance,
    signature,
    occurredAt,
    updated_at: updatedAt,
    deleted: false,
  };
}

export function parseResidentExperienceRow(row: ResidentExperienceRow): ResidentExperience | null {
  if (!row || isDeletedRow(row)) return null;
  const id = pickStringField(row, "id", "id");
  const experienceId = pickStringField(row, "experienceId", "experience_id");
  const residentId = pickStringField(row, "residentId", "resident_id");
  const awareness = toAwareness(pickStringField(row, "awareness", "awareness"));
  const appraisal = pickStringField(row, "appraisal", "appraisal");
  const hookIntent = toHookIntent(pickStringField(row, "hookIntent", "hook_intent"));
  const learnedAt = pickStringField(row, "learnedAt", "learned_at");
  const updatedAt = pickStringField(row, "updated_at", "updated_at");
  if (!id || !experienceId || !residentId || !awareness || !appraisal || !hookIntent || !learnedAt || !updatedAt) {
    return null;
  }

  const ownerId = pickStringField(row, "ownerId", "owner_id") ?? null;
  const confidenceRaw = row.confidence;
  const salienceRaw = row.salience;
  const confidence = clampToScore(typeof confidenceRaw === "number" ? confidenceRaw : Number(confidenceRaw));
  const salience = clampToScore(typeof salienceRaw === "number" ? salienceRaw : Number(salienceRaw));
  const expiresAt = pickStringField(row, "expiresAt", "expires_at") ?? null;

  return {
    id,
    ownerId,
    experienceId,
    residentId,
    awareness,
    appraisal,
    hookIntent,
    confidence,
    salience,
    learnedAt,
    expiresAt,
    updated_at: updatedAt,
    deleted: false,
  };
}

function recencyScore(fromIso: string, nowMs: number): number {
  const fromMs = parseIsoMillis(fromIso);
  if (fromMs <= 0 || nowMs <= 0) return 0;
  const ageHours = Math.max(0, (nowMs - fromMs) / 3600000);
  const windowHours = 72;
  if (ageHours >= windowHours) return 0;
  return clampToScore(((windowHours - ageHours) / windowHours) * 100);
}

function toExpressionStyle(input: { significance: number; confidence: number }): ConversationExpressionStyle {
  if (input.significance >= 65 && input.confidence >= 65) return "explicit";
  if (input.significance <= 35 && input.confidence <= 35) return "implicit";
  return "mixed";
}

function normalizeEvidenceText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export type BuildConversationBriefInput = {
  participants: [string, string];
  experienceEvents: ExperienceEvent[];
  residentExperiences: ResidentExperience[];
  nowIso?: string;
  recentAnchorSignatures?: string[];
  hasRecentConversation?: boolean;
};

export function buildConversationBrief(input: BuildConversationBriefInput): ConversationBrief {
  const [aId, bId] = input.participants;
  const nowMs = parseIsoMillis(input.nowIso ?? new Date().toISOString());
  const experienceById = new Map(input.experienceEvents.map((event) => [event.id, event]));
  const recentSignatureSet = new Set(input.recentAnchorSignatures ?? []);

  const validResidentExperiences = input.residentExperiences.filter((experience) => {
    if (experience.residentId !== aId && experience.residentId !== bId) return false;
    if (!experience.appraisal.trim()) return false;
    if (!HOOK_INTENTS.includes(experience.hookIntent)) return false;
    const expiresAtMs = parseIsoMillis(experience.expiresAt ?? undefined);
    if (expiresAtMs > 0 && expiresAtMs < nowMs) return false;
    return experienceById.has(experience.experienceId);
  });

  const byExperience = new Map<string, ResidentExperience[]>();
  for (const row of validResidentExperiences) {
    const arr = byExperience.get(row.experienceId) ?? [];
    arr.push(row);
    byExperience.set(row.experienceId, arr);
  }

  const scoredCandidates = Array.from(byExperience.entries()).map(([experienceId, rows]) => {
    const event = experienceById.get(experienceId)!;
    const salience = clampToScore(
      rows.reduce((max, row) => Math.max(max, row.salience), 0),
    );
    const confidence = clampToScore(
      rows.reduce((sum, row) => sum + row.confidence, 0) / Math.max(1, rows.length),
    );
    const recency = recencyScore(event.occurredAt, nowMs);
    const novelty = recentSignatureSet.has(event.signature) ? 0 : 100;
    const score = 0.35 * salience + 0.25 * confidence + 0.2 * recency + 0.2 * novelty;
    return {
      experienceId,
      event,
      rows,
      salience,
      confidence,
      score,
    };
  }).sort((lhs, rhs) => rhs.score - lhs.score);

  const top = scoredCandidates[0];
  if (!top) {
    const fallbackMode = input.hasRecentConversation ? "continuation" : "free";
    return {
      anchorFact: fallbackMode === "continuation" ? "直近の会話の続き" : "日常の雑談",
      speakerAppraisal: [],
      speakerHookIntent: [],
      expressionStyle: "mixed",
      fallbackMode,
    };
  }

  const speakerAppraisal = top.rows.map((row) => ({
    speakerId: row.residentId,
    text: normalizeEvidenceText(row.appraisal),
  }));
  const speakerHookIntent = top.rows.map((row) => ({
    speakerId: row.residentId,
    intent: row.hookIntent,
  }));

  return {
    anchorExperienceId: top.experienceId,
    anchorFact: normalizeEvidenceText(top.event.factSummary),
    anchorSignature: top.event.signature,
    speakerAppraisal,
    speakerHookIntent,
    expressionStyle: toExpressionStyle({
      significance: top.event.significance,
      confidence: top.confidence,
    }),
    fallbackMode: "experience",
  };
}
