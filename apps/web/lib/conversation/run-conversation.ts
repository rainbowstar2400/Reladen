// apps/web/lib/conversation/run-conversation.ts
// ------------------------------------------------------------
// 会話エンジンのオーケストレータ。
// 1) Experience Brief 生成（決定的）
// 2) GPT生成（callGptForConversation）
// 3) ローカル評価
// 4) 永続化
// ------------------------------------------------------------

import type { GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import type { EvaluationResult, EvalInput } from "@/lib/evaluation/evaluate-conversation";
import { evaluateConversation } from "@/lib/evaluation/evaluate-conversation";
import { persistConversation } from "@/lib/persist/persist-conversation";
import { callGptForConversation } from "@/lib/gpt/call-gpt-for-conversation";
import { newId } from "@/lib/newId";

import { listKV as listAny } from "@/lib/db/kv-server";
import type {
  ConversationBrief,
  ExperienceEvent,
  ResidentExperience,
  TopicThread,
} from "@repo/shared/types/conversation";
import {
  buildConversationBrief,
  parseExperienceEventRow,
  parseResidentExperienceRow,
} from "@/lib/conversation/experience-brief";
import { generateAndPersistExperienceForParticipants } from "@/lib/conversation/experience-generator";
import { assessConversationGrounding } from "@/lib/conversation/grounding";
import type {
  ConversationResidentProfile,
  ConversationPairContext,
} from "@repo/shared/gpt/prompts/conversation-prompt";

/** GPTに渡す thread 形状 */
type ThreadForGpt = {
  participants: [string, string];
  status: "ongoing" | "paused" | "done";
  id: string;
  updated_at: string;
  deleted: boolean;
  topic?: string;
  lastEventId?: string;
};

export type RunConversationArgs = {
  /** 既存スレッドID（無ければ undefined） */
  threadId?: string;
  /** 参加者 [A,B] */
  participants: [string, string];
  /** GPTへのヒント（任意） */
  topicHint?: string;
  /** 最終要約（任意） */
  lastSummary?: string;
  /** クライアント側で把握している住人プロフィール */
  residentProfilesOverride?: Record<string, ConversationResidentProfile>;
};

export type RunConversationResult = {
  eventId: string;
  threadId: string;
  gptOut: GptConversationOutput;
  evalResult: EvaluationResult;
};

async function loadResidentProfiles(
  participantIds: [string, string],
): Promise<Record<string, ConversationResidentProfile>> {
  const uniqueIds = Array.from(new Set(participantIds));
  if (uniqueIds.length === 0) return {};

  const presetRows = (await listAny("presets")) as unknown as Array<Record<string, unknown>> | null;
  const presetMap = new Map<string, Record<string, unknown>>();
  if (Array.isArray(presetRows)) {
    for (const raw of presetRows) {
      const id = typeof raw?.id === "string" ? raw.id : undefined;
      const isDeleted = Boolean((raw as any)?.deleted);
      if (!id || isDeleted) continue;
      presetMap.set(id, raw);
    }
  }

  const rows = (await listAny("residents")) as unknown as Array<Record<string, unknown>> | null;
  const dict: Record<string, ConversationResidentProfile> = {};
  if (!Array.isArray(rows)) return dict;

  const idSet = new Set(uniqueIds);
  for (const raw of rows) {
    const id = typeof raw?.id === "string" ? raw.id : undefined;
    if (!id || !idSet.has(id)) continue;

    const ageValue = raw && typeof (raw as any).age === "number"
      ? (raw as any).age
      : Number.isFinite(Number((raw as any)?.age))
        ? Number((raw as any).age)
        : null;
    const speechPresetRaw = (raw as any)?.speech_preset;
    const speechPresetId = typeof speechPresetRaw === "string" ? speechPresetRaw : null;
    const speechPreset = speechPresetId ? presetMap.get(speechPresetId) : undefined;
    const speechExample = typeof speechPreset?.example === "string" || speechPreset?.example === null
      ? (speechPreset as any).example ?? null
      : null;
    const firstPersonRaw = (raw as any)?.first_person;
    const firstPersonId = typeof firstPersonRaw === "string" ? firstPersonRaw : null;
    const firstPersonPreset = firstPersonId ? presetMap.get(firstPersonId) : undefined;

    dict[id] = {
      id,
      name: (raw as any)?.name ?? null,
      mbti: (raw as any)?.mbti ?? null,
      gender: (raw as any)?.gender ?? null,
      age: ageValue,
      occupation: (raw as any)?.occupation ?? null,
      speechPreset: (speechPreset as any)?.label ?? null,
      speechPresetDescription: (speechPreset as any)?.description ?? null,
      speechExample,
      firstPerson: (firstPersonPreset as any)?.label ?? null,
      traits: (raw as any)?.traits ?? null,
      interests: (raw as any)?.interests ?? null,
    };
  }

  return dict;
}

type RelationRow = {
  a_id?: string;
  b_id?: string;
  aId?: string;
  bId?: string;
  type?: string;
  updated_at?: string;
  updatedAt?: string;
  deleted?: boolean;
};

type FeelingRow = {
  id?: string;
  from_id?: string;
  to_id?: string;
  fromId?: string;
  toId?: string;
  label?: string;
  score?: number;
  updated_at?: string;
  updatedAt?: string;
  deleted?: boolean;
};

type EventRow = {
  id?: string;
  kind?: string;
  payload?: unknown;
  deleted?: boolean;
  updated_at?: string;
};

const BRIDGE_PHRASES = [
  "そういえば",
  "ところで",
  "その話で言うと",
  "関連して",
  "話は変わるけど",
] as const;
const SUMMARY_LINE_MAX = 42;

function toUpdatedAtMillis(row: { updated_at?: string; updatedAt?: string }): number {
  const raw = typeof row.updated_at === "string"
    ? row.updated_at
    : typeof row.updatedAt === "string"
      ? row.updatedAt
      : undefined;
  if (!raw) return 0;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : 0;
}

function pickRelationPair(row: RelationRow): { aId?: string; bId?: string } {
  const aId = typeof row.a_id === "string"
    ? row.a_id
    : typeof row.aId === "string"
      ? row.aId
      : undefined;
  const bId = typeof row.b_id === "string"
    ? row.b_id
    : typeof row.bId === "string"
      ? row.bId
      : undefined;
  return { aId, bId };
}

function pickFeelingPair(row: FeelingRow): { fromId?: string; toId?: string } {
  const fromId = typeof row.from_id === "string"
    ? row.from_id
    : typeof row.fromId === "string"
      ? row.fromId
      : undefined;
  const toId = typeof row.to_id === "string"
    ? row.to_id
    : typeof row.toId === "string"
      ? row.toId
      : undefined;
  return { fromId, toId };
}

function truncateForSummary(text: string, max = SUMMARY_LINE_MAX): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1))}…`;
}

function containsBridgePhrase(text: string): boolean {
  const line = text.trim();
  if (!line) return false;
  return BRIDGE_PHRASES.some((phrase) => line.includes(phrase));
}

function buildLastSummaryFromRecentLines(input: {
  recentLines: Array<{ speaker: string; text: string }>;
  residents: Record<string, ConversationResidentProfile>;
}): string | undefined {
  const lines = Array.isArray(input.recentLines) ? input.recentLines.slice(-2) : [];
  if (lines.length === 0) return undefined;
  const chunks = lines.map((line) => {
    const speaker = input.residents[line.speaker]?.name ?? line.speaker;
    return `${speaker}: ${truncateForSummary(line.text)}`;
  });
  return `直近会話: ${chunks.join(" / ")}`;
}

export function shouldAllowTopicShift(input: {
  previousTopic?: string;
  nextTopic?: string;
  tags?: string[];
  lines: Array<{ speaker: string; text: string }>;
}): boolean {
  const previous = input.previousTopic?.trim();
  const next = input.nextTopic?.trim();
  if (!previous || !next) return false;
  if (previous === next) return false;
  const tags = Array.isArray(input.tags) ? input.tags : [];
  if (!tags.includes("topic_shift")) return false;
  const firstHalf = input.lines.slice(0, Math.max(1, Math.ceil(input.lines.length / 2)));
  return firstHalf.some((line) => containsBridgePhrase(line.text));
}

function resolveEffectiveTopic(input: {
  thread: ThreadForGpt;
  gptOut: GptConversationOutput;
  nextThreadState: EvaluationResult["threadNextState"];
}): string {
  const previousTopic = input.thread.topic?.trim();
  const nextTopic = input.gptOut.topic?.trim() || previousTopic || "雑談";
  if (!previousTopic) return nextTopic;
  if (input.nextThreadState !== "ongoing") return nextTopic;
  if (shouldAllowTopicShift({
    previousTopic,
    nextTopic,
    tags: input.gptOut.meta?.tags,
    lines: input.gptOut.lines,
  })) {
    return nextTopic;
  }
  return previousTopic;
}

async function hasNoneRelationBetween(
  participants: [string, string],
): Promise<boolean> {
  const rows = (await listAny("relations")) as unknown as RelationRow[] | null;
  if (!Array.isArray(rows)) return false;

  const [a, b] = participants;

  return rows.some((rel) => {
    if (!rel || rel.deleted) return false;
    const { aId, bId } = pickRelationPair(rel);

    if (!aId || !bId) return false;
    const isPair =
      (aId === a && bId === b) ||
      (aId === b && bId === a);

    return isPair && rel.type === "none";
  });
}

async function loadRelationForPair(
  participants: [string, string],
): Promise<ConversationPairContext["relationType"]> {
  const rows = (await listAny("relations")) as unknown as RelationRow[] | null;
  if (!Array.isArray(rows)) return undefined;
  const [a, b] = participants;

  const matches = rows
    .filter((rel) => {
      if (!rel || rel.deleted || typeof rel.type !== "string") return false;
      const { aId, bId } = pickRelationPair(rel);
      if (!aId || !bId) return false;
      return (aId === a && bId === b) || (aId === b && bId === a);
    })
    .sort((lhs, rhs) => toUpdatedAtMillis(rhs) - toUpdatedAtMillis(lhs));

  if (matches.length === 0) return undefined;
  return matches[0].type;
}

async function loadFeelingsForPair(
  participants: [string, string],
): Promise<NonNullable<ConversationPairContext["feelings"]> | undefined> {
  const rows = (await listAny("feelings")) as unknown as FeelingRow[] | null;
  if (!Array.isArray(rows)) return undefined;
  const [a, b] = participants;

  const pickLatest = (fromId: string, toId: string) => {
    const found = rows
      .filter((row) => {
        if (!row || row.deleted) return false;
        const pair = pickFeelingPair(row);
        return pair.fromId === fromId && pair.toId === toId;
      })
      .sort((lhs, rhs) => toUpdatedAtMillis(rhs) - toUpdatedAtMillis(lhs))[0];
    if (!found) return undefined;
    return {
      label: typeof found.label === "string" ? found.label : undefined,
      score: typeof found.score === "number" && Number.isFinite(found.score)
        ? found.score
        : undefined,
    };
  };

  const aToB = pickLatest(a, b);
  const bToA = pickLatest(b, a);
  if (!aToB && !bToA) return undefined;
  return { aToB, bToA };
}

async function loadRecentLinesFromThread(
  thread: ThreadForGpt,
): Promise<Array<{ speaker: string; text: string }>> {
  if (!thread.lastEventId) return [];
  const rows = (await listAny("events")) as unknown as EventRow[] | null;
  if (!Array.isArray(rows)) return [];

  const event = rows.find((row) => row?.id === thread.lastEventId && !row?.deleted);
  if (!event || event.kind !== "conversation") return [];

  const payload = event.payload as { lines?: unknown } | undefined;
  const sourceLines = Array.isArray(payload?.lines) ? payload.lines : [];

  return sourceLines
    .map((line) => {
      const speaker = typeof (line as any)?.speaker === "string" ? (line as any).speaker : "";
      const text = typeof (line as any)?.text === "string" ? (line as any).text.trim() : "";
      if (!speaker || !text) return null;
      return { speaker, text };
    })
    .filter((line): line is { speaker: string; text: string } => Boolean(line))
    .slice(-4);
}

async function loadRecentAnchorSignaturesForPair(
  participants: [string, string],
): Promise<string[]> {
  const rows = (await listAny("events")) as unknown as EventRow[] | null;
  if (!Array.isArray(rows)) return [];
  const [a, b] = participants;

  return rows
    .filter((row) => row?.kind === "conversation" && !row?.deleted)
    .sort((lhs, rhs) => {
      const l = typeof lhs?.updated_at === "string" ? Date.parse(lhs.updated_at) : 0;
      const r = typeof rhs?.updated_at === "string" ? Date.parse(rhs.updated_at) : 0;
      return (Number.isFinite(r) ? r : 0) - (Number.isFinite(l) ? l : 0);
    })
    .map((row) => row.payload as {
      participants?: unknown;
      meta?: { anchorSignature?: unknown } | null;
    } | undefined)
    .filter((payload) => {
      const ps = payload?.participants;
      return Array.isArray(ps)
        && ps.length === 2
        && ((ps[0] === a && ps[1] === b) || (ps[0] === b && ps[1] === a));
    })
    .map((payload) => payload?.meta?.anchorSignature)
    .filter((signature): signature is string => typeof signature === "string" && signature.length > 0)
    .slice(0, 30);
}

function fallbackBrief(hasRecentConversation: boolean): ConversationBrief {
  const fallbackMode = hasRecentConversation ? "continuation" : "free";
  return {
    anchorFact: fallbackMode === "continuation" ? "直近の会話の続き" : "日常の雑談",
    speakerAppraisal: [],
    speakerHookIntent: [],
    expressionStyle: "mixed",
    fallbackMode,
  };
}

function isExperienceModeEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_EXPERIENCE_MODE ?? "on").toLowerCase() !== "off";
}

async function loadExperienceBrief(input: {
  participants: [string, string];
  hasRecentConversation: boolean;
  nowIso: string;
}): Promise<ConversationBrief> {
  const [eventRows, residentRows, recentAnchorSignatures] = await Promise.all([
    listAny("experience_events") as Promise<Array<Record<string, unknown>>>,
    listAny("resident_experiences") as Promise<Array<Record<string, unknown>>>,
    loadRecentAnchorSignaturesForPair(input.participants),
  ]);

  const events: ExperienceEvent[] = Array.isArray(eventRows)
    ? eventRows
        .map((row) => parseExperienceEventRow(row))
        .filter((row): row is ExperienceEvent => Boolean(row))
    : [];
  const residentExperiences: ResidentExperience[] = Array.isArray(residentRows)
    ? residentRows
        .map((row) => parseResidentExperienceRow(row))
        .filter((row): row is ResidentExperience => Boolean(row))
    : [];

  if (events.length === 0 || residentExperiences.length === 0) {
    return fallbackBrief(input.hasRecentConversation);
  }

  return buildConversationBrief({
    participants: input.participants,
    experienceEvents: events,
    residentExperiences,
    nowIso: input.nowIso,
    recentAnchorSignatures,
    hasRecentConversation: input.hasRecentConversation,
  });
}

function withGroundingMeta(
  gptOut: GptConversationOutput,
  brief: ConversationBrief,
): GptConversationOutput {
  const grounding = assessConversationGrounding({
    brief,
    lines: gptOut.lines,
  });

  return {
    ...gptOut,
    meta: {
      ...gptOut.meta,
      anchorExperienceId: brief.anchorExperienceId,
      anchorSignature: brief.anchorSignature,
      fallbackMode: brief.fallbackMode,
      grounded: grounding.ok,
      groundingEvidence: grounding.evidence,
    },
  };
}

/** threadId と participants から GPT向けの thread オブジェクトを構築 */
async function ensureThreadForGpt(input: {
  threadId?: string;
  participants: [string, string];
}): Promise<ThreadForGpt> {
  const now = new Date().toISOString();

  if (input.threadId) {
    const allThreads = (await listAny("topic_threads")) as unknown as
      | TopicThread[]
      | null;

    if (Array.isArray(allThreads)) {
      const found = allThreads.find((t) => t.id === input.threadId);

      if (found) {
        const t = found;
        const status: "ongoing" | "paused" | "done" = (t.status ??
          "ongoing") as any;
        return {
          id: t.id,
          participants:
            (t.participants as [string, string]) ?? input.participants,
          status,
          topic: t.topic,
          lastEventId: (t as any).lastEventId ?? (t as any).last_event_id,
          updated_at: t.updated_at ?? now,
          deleted: !!t.deleted,
        };
      }
    }
  }

  return {
    id: input.threadId ?? newId(),
    participants: input.participants,
    status: "ongoing",
    updated_at: now,
    deleted: false,
  };
}

export async function runConversation(
  args: RunConversationArgs,
): Promise<RunConversationResult> {
  const {
    participants,
    threadId,
    topicHint,
    lastSummary,
    residentProfilesOverride,
  } = args;

  const thread: ThreadForGpt = await ensureThreadForGpt({
    threadId,
    participants,
  });
  const participantSet = new Set(participants);

  let relationBlocked = false;
  try {
    relationBlocked = await hasNoneRelationBetween(thread.participants);
  } catch (error) {
    console.warn('[runConversation] Failed to load relations for participants.', error);
  }
  if (relationBlocked) {
    throw new Error("[runConversation] Conversation aborted because relation is 'none'.");
  }

  let residents: Record<string, ConversationResidentProfile> = {};
  try {
    residents = await loadResidentProfiles(participants);
  } catch (error) {
    console.warn('[runConversation] Failed to load residents from server, fallback to overrides.', error);
  }
  if (residentProfilesOverride) {
    for (const [residentId, profile] of Object.entries(residentProfilesOverride)) {
      if (!participantSet.has(residentId) || !profile?.id) continue;
      residents[residentId] = profile;
    }
  }

  let pairContext: ConversationPairContext | undefined;
  let relationType: ConversationPairContext["relationType"] | undefined;
  let feelings: NonNullable<ConversationPairContext["feelings"]> | undefined;
  let recentLines: Array<{ speaker: string; text: string }> = [];

  try {
    relationType = await loadRelationForPair(thread.participants);
  } catch (error) {
    console.warn("[runConversation] Failed to load pair relation context.", error);
  }

  try {
    feelings = await loadFeelingsForPair(thread.participants);
  } catch (error) {
    console.warn("[runConversation] Failed to load pair feeling context.", error);
  }

  try {
    recentLines = await loadRecentLinesFromThread(thread);
  } catch (error) {
    console.warn("[runConversation] Failed to load recent lines for prompt context.", error);
  }

  if (relationType || feelings || recentLines.length > 0) {
    pairContext = {
      relationType,
      feelings,
      recentLines: recentLines.length > 0 ? recentLines : undefined,
    };
  }
  const effectiveLastSummary = (typeof lastSummary === "string" && lastSummary.trim().length > 0)
    ? lastSummary.trim()
    : buildLastSummaryFromRecentLines({
      recentLines,
      residents,
    });

  const nowIso = new Date().toISOString();
  if (isExperienceModeEnabled()) {
    try {
      await generateAndPersistExperienceForParticipants({
        participants: thread.participants,
        nowIso,
      });
    } catch (error) {
      console.warn("[runConversation] Failed to generate experience events.", error);
    }
  }

  let brief = fallbackBrief(recentLines.length > 0);
  try {
    brief = await loadExperienceBrief({
      participants: thread.participants,
      hasRecentConversation: recentLines.length > 0,
      nowIso,
    });
  } catch (error) {
    console.warn("[runConversation] Failed to load experiences. Fallback to continuation/free mode.", error);
  }

  const gptOutRaw: GptConversationOutput = await callGptForConversation({
    thread,
    brief,
    topicHint,
    lastSummary: effectiveLastSummary,
    residents,
    pairContext,
  });

  if (!gptOutRaw) {
    throw new Error(
      "[runConversation] gptOut is null or undefined. callGptForConversation likely failed.",
    );
  }

  const gptOut = withGroundingMeta(gptOutRaw, brief);
  const ensuredThreadId = gptOut.threadId;

  const evalInput: EvalInput = {
    threadId: ensuredThreadId,
    participants,
    lines: gptOut.lines,
    meta: gptOut.meta,
  };
  const evalResult = evaluateConversation(evalInput);

  const effectiveTopic = resolveEffectiveTopic({
    thread,
    gptOut,
    nextThreadState: evalResult.threadNextState,
  });
  const effectiveGptOut = effectiveTopic === gptOut.topic
    ? gptOut
    : { ...gptOut, topic: effectiveTopic };

  const { eventId } = await persistConversation({
    gptOut: effectiveGptOut,
    evalResult,
  });

  return {
    eventId,
    threadId: ensuredThreadId,
    gptOut: effectiveGptOut,
    evalResult,
  };
}
