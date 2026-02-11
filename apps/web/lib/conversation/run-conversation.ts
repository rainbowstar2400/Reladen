// apps/web/lib/conversation/run-conversation.ts
// ------------------------------------------------------------
// 会話エンジンのオーケストレータ。
// 1) GPT生成（callGptForConversation）→ 2) ローカル評価 → 3) 永続化
// ------------------------------------------------------------

import type { GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import type { EvaluationResult, EvalInput } from "@/lib/evaluation/evaluate-conversation";
import { evaluateConversation } from "@/lib/evaluation/evaluate-conversation";
import { persistConversation } from "@/lib/persist/persist-conversation";
import { callGptForConversation } from "@/lib/gpt/call-gpt-for-conversation";
import { newId } from "@/lib/newId";

import { listKV as listAny } from "@/lib/db/kv-server";
import type { BeliefRecord, TopicThread } from "@repo/shared/types/conversation";
import { beliefRowToRecord } from "@/lib/conversation/belief-mapper";
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
  /** クライアント側で把握している Belief */
  beliefsOverride?: Record<string, BeliefRecord>;
};

export type RunConversationResult = {
  eventId: string;
  threadId: string;
  gptOut: GptConversationOutput;
  evalResult: EvaluationResult;
};

/** beliefs を Record<residentId, BeliefRecord> でロード */
async function loadBeliefsDict(): Promise<Record<string, BeliefRecord>> {
  // arr が null の可能性を考慮
  const arr = (await listAny("beliefs")) as unknown as Array<Record<string, unknown>> | null;
  const dict: Record<string, BeliefRecord> = {};

  if (Array.isArray(arr)) {
    for (const raw of arr) {
      const rec = beliefRowToRecord(raw as any);
      if (rec?.residentId) {
        dict[rec.residentId] = rec;
      }
    }
  }
  return dict;
}

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

/** threadId と participants から GPT向けの thread オブジェクトを構築 */
async function ensureThreadForGpt(input: {
  threadId?: string;
  participants: [string, string];
}): Promise<ThreadForGpt> {
  const now = new Date().toISOString();

  if (input.threadId) {
    // allThreads が null の可能性を考慮
    const allThreads = (await listAny("topic_threads")) as unknown as
      | TopicThread[]
      | null;

    // allThreads が配列であることを確認
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

  // 新規スレッド相当（最低限の形）
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
    beliefsOverride,
  } = args;

  // 1) thread / beliefs を用意
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

  let beliefs: Record<string, BeliefRecord> = {};
  try {
    beliefs = await loadBeliefsDict();
  } catch (error) {
    console.warn('[runConversation] Failed to load beliefs from server, fallback to overrides.', error);
  }
  if (beliefsOverride) {
    for (const [residentId, rec] of Object.entries(beliefsOverride)) {
      if (!participantSet.has(residentId) || !rec?.residentId) continue;
      beliefs[residentId] = rec;
    }
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

  // 2) GPT 生成
  // ✅ ここがポイント：`threadId` を渡さない。代わりに `thread` と `beliefs` を渡す。
  const gptOut: GptConversationOutput = await callGptForConversation({
    thread,
    beliefs,
    topicHint,
    lastSummary: effectiveLastSummary,
    residents,
    pairContext,
  });

  // gptOut 自体が null/undefined の場合、即時エラー
  // (APIエラーやZodパース失敗の可能性があるため)
  if (!gptOut) {
    throw new Error(
      "[runConversation] gptOut is null or undefined. callGptForConversation likely failed.",
    );
  }

  // 念のため threadId を GPT の返却値から確定
  const ensuredThreadId = gptOut.threadId;

  // 3) ローカル評価
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

  // 4) 永続化
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
