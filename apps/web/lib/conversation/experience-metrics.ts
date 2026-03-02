/**
 * @deprecated v2パイプラインでは使用しない。
 * v2パイプラインが本番導入された後に削除予定。
 */
import type { EventLogStrict } from "@repo/shared/types/conversation";

type ConversationMetricRow = {
  occurredAtMs: number;
  pairKey: string;
  anchorSignature?: string;
  isGrounded: boolean;
};

const DEFAULT_GROUNDING_WINDOW_HOURS = 24;
const DEFAULT_REPEAT_WINDOW_SIZE = 30;
const DEFAULT_REPEAT_COOLDOWN_HOURS = 36;

function toMillis(input: unknown): number {
  if (typeof input !== "string" || input.trim().length === 0) return 0;
  const value = Date.parse(input);
  return Number.isFinite(value) ? value : 0;
}

function toParticipants(input: unknown): [string, string] | null {
  if (!Array.isArray(input) || input.length !== 2) return null;
  const a = typeof input[0] === "string" ? input[0] : "";
  const b = typeof input[1] === "string" ? input[1] : "";
  if (!a || !b) return null;
  return [a, b];
}

function toPairKey(participants: [string, string]): string {
  return [...participants].sort().join(":");
}

function parseConversationMetricRow(event: EventLogStrict): ConversationMetricRow | null {
  if (!event || event.deleted || event.kind !== "conversation") return null;

  const payload = event.payload as Record<string, unknown> | undefined;
  if (!payload || typeof payload !== "object") return null;
  const participants = toParticipants(payload.participants);
  if (!participants) return null;

  const meta = payload.meta as Record<string, unknown> | undefined;
  const occurredAtMs = toMillis(payload.occurredAt) || toMillis((event as any).updated_at);
  if (!occurredAtMs) return null;

  const anchorExperienceId = typeof meta?.anchorExperienceId === "string"
    ? meta.anchorExperienceId.trim()
    : "";
  const groundingEvidence = Array.isArray(meta?.groundingEvidence)
    ? meta?.groundingEvidence.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const isGrounded = meta?.grounded === true
    && anchorExperienceId.length > 0
    && groundingEvidence.length > 0;

  const anchorSignature = typeof meta?.anchorSignature === "string" && meta.anchorSignature.trim().length > 0
    ? meta.anchorSignature.trim()
    : undefined;

  return {
    occurredAtMs,
    pairKey: toPairKey(participants),
    anchorSignature,
    isGrounded,
  };
}

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

export type ConversationQualityMetrics = {
  generatedAt: string;
  grounding: {
    windowHours: number;
    totalConversations: number;
    groundedConversations: number;
    rate: number;
    targetRate: number;
    meetsTarget: boolean;
  };
  repetition: {
    recentConversationWindow: number;
    cooldownHours: number;
    totalConversations: number;
    repeatedConversations: number;
    rate: number;
    targetRate: number;
    meetsTarget: boolean;
  };
};

export function computeConversationQualityMetrics(input: {
  events: EventLogStrict[];
  nowIso?: string;
  groundingWindowHours?: number;
  repeatWindowSize?: number;
  repeatCooldownHours?: number;
  groundingTargetRate?: number;
  repeatTargetRate?: number;
}): ConversationQualityMetrics {
  const groundingWindowHours = input.groundingWindowHours ?? DEFAULT_GROUNDING_WINDOW_HOURS;
  const repeatWindowSize = input.repeatWindowSize ?? DEFAULT_REPEAT_WINDOW_SIZE;
  const repeatCooldownHours = input.repeatCooldownHours ?? DEFAULT_REPEAT_COOLDOWN_HOURS;
  const groundingTargetRate = input.groundingTargetRate ?? 0.7;
  const repeatTargetRate = input.repeatTargetRate ?? 0.15;

  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = toMillis(nowIso) || Date.now();
  const groundingFromMs = nowMs - groundingWindowHours * 60 * 60 * 1000;
  const repeatCooldownMs = repeatCooldownHours * 60 * 60 * 1000;

  const rows = input.events
    .map((event) => parseConversationMetricRow(event))
    .filter((row): row is ConversationMetricRow => row !== null);

  const conversationsInGroundingWindow = rows.filter((row) => (
    row.occurredAtMs >= groundingFromMs && row.occurredAtMs <= nowMs
  ));
  const groundedConversations = conversationsInGroundingWindow.filter((row) => row.isGrounded).length;
  const groundingRate = rate(groundedConversations, conversationsInGroundingWindow.length);

  const recentForRepeat = [...rows]
    .sort((lhs, rhs) => rhs.occurredAtMs - lhs.occurredAtMs)
    .slice(0, repeatWindowSize)
    .sort((lhs, rhs) => lhs.occurredAtMs - rhs.occurredAtMs);

  let repeatedConversations = 0;
  for (let i = 0; i < recentForRepeat.length; i += 1) {
    const current = recentForRepeat[i];
    if (!current.anchorSignature) continue;
    const hasPreviousSameAnchor = recentForRepeat.slice(0, i).some((previous) => (
      previous.anchorSignature === current.anchorSignature
      && previous.pairKey === current.pairKey
      && current.occurredAtMs - previous.occurredAtMs <= repeatCooldownMs
    ));
    if (hasPreviousSameAnchor) repeatedConversations += 1;
  }
  const repeatRate = rate(repeatedConversations, recentForRepeat.length);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    grounding: {
      windowHours: groundingWindowHours,
      totalConversations: conversationsInGroundingWindow.length,
      groundedConversations,
      rate: groundingRate,
      targetRate: groundingTargetRate,
      meetsTarget: groundingRate >= groundingTargetRate,
    },
    repetition: {
      recentConversationWindow: repeatWindowSize,
      cooldownHours: repeatCooldownHours,
      totalConversations: recentForRepeat.length,
      repeatedConversations,
      rate: repeatRate,
      targetRate: repeatTargetRate,
      meetsTarget: repeatRate < repeatTargetRate,
    },
  };
}
