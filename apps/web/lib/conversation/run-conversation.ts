// apps/web/lib/conversation/run-conversation.ts
// 会話生成パイプライン オーケストレータ
//
// 1. 入力データ収集（キャラ、関係性、スニペット、記憶等）
// 2. 動機生成（話題選定）
// 3. 会話構造決定（主導権、スタンス、温度感）
// 4. プロンプト構築 + GPT呼び出し + 検証 + リトライ
// 5. 永続化（events, threads, feelings, notifications）
// 6. 結果返却

import type {
  ConversationOutput,
  ConversationMemory,
  SharedSnippet,
  OffscreenKnowledge,
  SpeechProfile,
  Traits,
  SelectedTopic,
} from "@repo/shared/types/conversation-generation";
import { selectTopic, type TopicSelectionInput, type CharacterContext } from "@repo/shared/logic/topic-selection";
import { buildConversationStructure, determineInitiator, type StructureInput } from "@repo/shared/logic/conversation-structure";
import { callGptForConversation, type CallGptResult } from "@/lib/gpt/call-gpt-for-conversation";
import type { PromptInput, CharacterProfile } from "@repo/shared/gpt/prompts/conversation-prompt";
import { newId } from "@/lib/newId";
import { KvUnauthenticatedError, listKV as listAny } from "@/lib/db/kv-server";
import { persistConversation } from "@/lib/persist/persist-conversation";
import { evaluateConversation, type EvalInput } from "@/lib/evaluation/evaluate-conversation";
import type { GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import { z } from "zod";

// ---------------------------------------------------------------------------
// 入力型
// ---------------------------------------------------------------------------

/** パイプラインの入力（データが既に解決済みの場合） */
export type RunConversationArgs = {
  participants: [string, string];
  /** キャラプロフィール */
  characters: Record<string, RunCharacterProfile>;
  /** ペアの関係性 */
  relation: {
    type: "none" | "acquaintance" | "friend" | "best_friend" | "lover" | "family";
    feelingAtoB: { label: string; score: number };
    feelingBtoA: { label: string; score: number };
  };
  /** 環境 */
  environment: { place: string; timeOfDay: string; weather?: string };
  /** 前回の会話記憶 */
  previousMemory?: ConversationMemory | null;
  /** 最近の共有スニペット */
  recentSnippets?: SharedSnippet[];
  /** キャラAが他キャラについて知っていること */
  knowledgeByA?: OffscreenKnowledge[];
  /** キャラBが他キャラについて知っていること */
  knowledgeByB?: OffscreenKnowledge[];
  /** 最近使われた話題（重複回避用） */
  recentTopics?: string[];
  /** 既存スレッドID（なければ新規） */
  threadId?: string;
};

export type RunCharacterProfile = {
  id: string;
  name: string;
  gender?: string | null;
  age?: number | null;
  occupation?: string | null;
  firstPerson?: string | null;
  mbti?: string | null;
  traits: Partial<Traits>;
  interests: string[];
  speechProfile?: SpeechProfile | null;
};

/** パイプラインの結果 */
export type RunConversationResult = {
  threadId: string;
  output: ConversationOutput;
  retried: boolean;
  violations: string[];
  debug: {
    topicCandidates: Array<{ source: string; label: string; score: number }>;
    selectedTopic: { source: string; label: string };
    structure: {
      initiator: string;
      responder: string;
      initiatorStance: string;
      responderStance: string;
      temperature: string;
    };
  };
};

/** APIルートからの入力 */
export type RunConversationApiArgs =
  | { threadId: string }
  | { participants: [string, string] };

/** APIルートへの返却 */
export type RunConversationApiResult = {
  eventId: string;
  threadId: string;
};

export type ConversationStartErrorCode =
  | "thread_not_found"
  | "invalid_thread_participants"
  | "preset_load_failed";

export class ConversationStartError extends Error {
  status: number;
  code: ConversationStartErrorCode;

  constructor(code: ConversationStartErrorCode, status: number, message?: string) {
    super(message ?? code);
    this.name = "ConversationStartError";
    this.code = code;
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function toCharacterContext(profile: RunCharacterProfile): CharacterContext {
  return {
    id: profile.id,
    name: profile.name,
    traits: profile.traits,
    interests: profile.interests,
  };
}

function toCharacterProfile(profile: RunCharacterProfile): CharacterProfile {
  return {
    id: profile.id,
    name: profile.name,
    gender: profile.gender,
    age: profile.age,
    occupation: profile.occupation,
    firstPerson: profile.firstPerson,
    mbti: profile.mbti,
    traits: profile.traits,
    interests: profile.interests,
    speechProfile: profile.speechProfile,
  };
}

// ---------------------------------------------------------------------------
// KV データ読み込み
// ---------------------------------------------------------------------------

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

type TopicThreadRow = {
  id?: string;
  participants?: unknown;
  deleted?: boolean;
};

const uuidStringSchema = z.string().uuid();

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
  return {
    aId: typeof row.a_id === "string" ? row.a_id : typeof row.aId === "string" ? row.aId : undefined,
    bId: typeof row.b_id === "string" ? row.b_id : typeof row.bId === "string" ? row.bId : undefined,
  };
}

function pickFeelingPair(row: FeelingRow): { fromId?: string; toId?: string } {
  return {
    fromId: typeof row.from_id === "string" ? row.from_id : typeof row.fromId === "string" ? row.fromId : undefined,
    toId: typeof row.to_id === "string" ? row.to_id : typeof row.toId === "string" ? row.toId : undefined,
  };
}

function toParticipantTuple(value: unknown): [string, string] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [a, b] = value;
  if (typeof a !== "string" || typeof b !== "string") return null;
  if (!uuidStringSchema.safeParse(a).success || !uuidStringSchema.safeParse(b).success) return null;
  if (a === b) return null;
  return [a, b];
}

/** 住民プロフィールを KV から読み込み、RunCharacterProfile に変換 */
async function loadCharacterProfiles(
  participantIds: [string, string],
): Promise<Record<string, RunCharacterProfile>> {
  const uniqueIds = Array.from(new Set(participantIds));
  if (uniqueIds.length === 0) return {};

  let presetRows: Array<Record<string, unknown>> | null = null;
  try {
    presetRows = (await listAny("presets")) as unknown as Array<Record<string, unknown>> | null;
  } catch (error) {
    if (error instanceof KvUnauthenticatedError) {
      throw error;
    }
    const msg = (error as Error)?.message ?? String(error);
    console.error("[runConversationFromApi] Failed to load presets required for style-aware conversation.", {
      participants: participantIds,
      message: msg,
    });
    throw new ConversationStartError(
      "preset_load_failed",
      503,
      `[runConversationFromApi] Failed to load presets required for style-aware conversation generation: ${msg}`,
    );
  }

  const presetMap = new Map<string, Record<string, unknown>>();
  if (Array.isArray(presetRows)) {
    for (const raw of presetRows) {
      const id = typeof raw?.id === "string" ? raw.id : undefined;
      if (!id || Boolean((raw as any)?.deleted)) continue;
      presetMap.set(id, raw);
    }
  }

  const rows = (await listAny("residents")) as unknown as Array<Record<string, unknown>> | null;
  const dict: Record<string, RunCharacterProfile> = {};
  if (!Array.isArray(rows)) return dict;

  const idSet = new Set(uniqueIds);
  for (const raw of rows) {
    const id = typeof raw?.id === "string" ? raw.id : undefined;
    if (!id || !idSet.has(id)) continue;

    const r = raw as any;

    // 年齢
    const age = typeof r.age === "number" ? r.age
      : Number.isFinite(Number(r.age)) ? Number(r.age) : null;

    // 一人称
    const firstPersonId = typeof r.first_person === "string" ? r.first_person : null;
    const firstPersonPreset = firstPersonId ? presetMap.get(firstPersonId) : undefined;
    const firstPerson = (firstPersonPreset as any)?.label ?? null;

    // 口調プリセット → SpeechProfile に変換
    const speechPresetId = typeof r.speech_preset === "string" ? r.speech_preset : null;
    const speechPreset = speechPresetId ? presetMap.get(speechPresetId) : undefined;
    let speechProfile: SpeechProfile | null = null;
    if (speechPreset) {
      const label = typeof (speechPreset as any).label === "string" ? (speechPreset as any).label : "";
      const description = typeof (speechPreset as any).description === "string" ? (speechPreset as any).description : "";
      const example = typeof (speechPreset as any).example === "string" ? (speechPreset as any).example : "";
      if (label && description) {
        speechProfile = {
          label,
          description,
          endings: [],          // 既存プリセットには語尾情報がない → 空（今後LLM抽出で補完）
          frequentPhrases: [],
          avoidedPhrases: [],
          examples: example ? [example] : [`（${label}の口調）`],
        };
      }
    }

    // 性格特性
    const rawTraits = r.traits;
    const traits: Partial<Traits> = {};
    if (rawTraits && typeof rawTraits === "object") {
      for (const key of ["sociability", "empathy", "stubbornness", "activity", "expressiveness"] as const) {
        const v = (rawTraits as any)[key];
        if (typeof v === "number" && v >= 1 && v <= 5) traits[key] = v;
      }
    }

    // 興味タグ
    const interests: string[] = Array.isArray(r.interests) ? r.interests.filter((i: unknown) => typeof i === "string") : [];

    dict[id] = {
      id,
      name: r.name ?? "不明",
      gender: r.gender ?? null,
      age,
      occupation: r.occupation ?? null,
      firstPerson,
      mbti: r.mbti ?? null,
      traits,
      interests,
      speechProfile,
    };
  }

  return dict;
}

async function resolveParticipantsFromThread(
  threadId: string,
): Promise<[string, string]> {
  const rows = (await listAny("topic_threads")) as unknown as TopicThreadRow[] | null;
  if (!Array.isArray(rows)) {
    throw new ConversationStartError(
      "thread_not_found",
      404,
      `[runConversationFromApi] Thread not found: ${threadId}`,
    );
  }

  const thread = rows.find((row) => row?.id === threadId && !row?.deleted);
  if (!thread) {
    throw new ConversationStartError(
      "thread_not_found",
      404,
      `[runConversationFromApi] Thread not found: ${threadId}`,
    );
  }

  const participants = toParticipantTuple(thread.participants);
  if (!participants) {
    throw new ConversationStartError(
      "invalid_thread_participants",
      422,
      `[runConversationFromApi] Invalid participants stored in topic_threads: ${threadId}`,
    );
  }

  return participants;
}

/** 関係性タイプを KV から読み込み */
async function loadRelationTypeForPair(
  participants: [string, string],
): Promise<string | undefined> {
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

  return matches[0]?.type;
}

/** 好感度を KV から読み込み */
async function loadFeelingsForPair(
  participants: [string, string],
): Promise<{ aToB: { label: string; score: number }; bToA: { label: string; score: number } }> {
  const rows = (await listAny("feelings")) as unknown as FeelingRow[] | null;
  const [a, b] = participants;

  const pickLatest = (fromId: string, toId: string): { label: string; score: number } => {
    if (!Array.isArray(rows)) return { label: "none", score: 0 };
    const found = rows
      .filter((row) => {
        if (!row || row.deleted) return false;
        const pair = pickFeelingPair(row);
        return pair.fromId === fromId && pair.toId === toId;
      })
      .sort((lhs, rhs) => toUpdatedAtMillis(rhs) - toUpdatedAtMillis(lhs))[0];
    return {
      label: typeof found?.label === "string" ? found.label : "none",
      score: typeof found?.score === "number" && Number.isFinite(found.score) ? found.score : 0,
    };
  };

  return { aToB: pickLatest(a, b), bToA: pickLatest(b, a) };
}

/** 時間帯に基づく環境情報を決定 */
function determineEnvironment(): { place: string; timeOfDay: string } {
  const now = new Date();
  const hourText = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    hour12: false,
  }).format(now);
  const hour = Number(hourText);
  const effectiveHour = Number.isFinite(hour) ? hour : now.getUTCHours();
  if (effectiveHour >= 6 && effectiveHour < 11) return { place: "駅前カフェ", timeOfDay: "朝" };
  if (effectiveHour >= 11 && effectiveHour < 16) return { place: "商店街", timeOfDay: "昼" };
  if (effectiveHour >= 16 && effectiveHour < 20) return { place: "川沿い公園", timeOfDay: "夕方" };
  return { place: "コンビニ", timeOfDay: "夜" };
}

// ---------------------------------------------------------------------------
// パイプライン（データ解決済み版）
// ---------------------------------------------------------------------------

export async function runConversation(
  args: RunConversationArgs,
): Promise<RunConversationResult> {
  const [aId, bId] = args.participants;
  const charA = args.characters[aId];
  const charB = args.characters[bId];

  if (!charA || !charB) {
    throw new Error(`[runConversation] Missing character profile for participants.`);
  }

  // 関係性が "none" なら会話しない
  if (args.relation.type === "none") {
    throw new Error("[runConversation] Conversation aborted because relation is 'none'.");
  }

  const threadId = args.threadId ?? newId();
  const ctxA = toCharacterContext(charA);
  const ctxB = toCharacterContext(charB);

  // 話題選定と会話構造の主導者を一致させるため、先に主導者シードを確定する。
  const seedTopic: SelectedTopic = {
    source: "environmental",
    label: `${args.environment.place}での出来事`,
    detail: `${args.environment.timeOfDay}の${args.environment.place}`,
  };
  const { initiator: seedInitiator, responder: seedResponder } = determineInitiator(ctxA, ctxB, seedTopic);

  // --- 1. 話題選定 ---
  const topicInput: TopicSelectionInput = {
    characterA: ctxA,
    characterB: ctxB,
    relation: args.relation,
    previousMemory: args.previousMemory ?? null,
    recentSnippets: args.recentSnippets ?? [],
    knowledgeByA: args.knowledgeByA ?? [],
    knowledgeByB: args.knowledgeByB ?? [],
    recentTopics: args.recentTopics ?? [],
    environment: args.environment,
  };

  const { selected: topic, candidates: topicCandidates } = selectTopic(
    topicInput,
    seedInitiator,
    seedResponder,
  );

  // --- 2. 会話構造決定 ---
  const structureInput: StructureInput = {
    characterA: ctxA,
    characterB: ctxB,
    relation: args.relation,
    topic,
    initiatorOverrideId: seedInitiator.id,
  };
  const structure = buildConversationStructure(structureInput);

  // --- 3. プロンプト構築 + GPT呼び出し ---
  const promptInput: PromptInput = {
    characters: [toCharacterProfile(charA), toCharacterProfile(charB)],
    relation: args.relation,
    structure,
    topic,
    environment: args.environment,
    recentSnippets: args.recentSnippets ?? [],
    previousMemory: args.previousMemory ?? null,
    threadId,
  };

  // 一人称マップ
  const firstPersonMap: Record<string, string> = {};
  if (charA.firstPerson) firstPersonMap[charA.id] = charA.firstPerson;
  if (charB.firstPerson) firstPersonMap[charB.id] = charB.firstPerson;

  const gptResult: CallGptResult = await callGptForConversation(
    promptInput,
    structure,
    firstPersonMap,
  );

  return {
    threadId,
    output: gptResult.output,
    retried: gptResult.retried,
    violations: gptResult.violations,
    debug: {
      topicCandidates: topicCandidates.map((c) => ({
        source: c.source,
        label: c.label,
        score: c.score,
      })),
      selectedTopic: {
        source: topic.source,
        label: topic.label,
      },
      structure: {
        initiator: structure.initiatorName,
        responder: structure.responderName,
        initiatorStance: structure.initiatorStance,
        responderStance: structure.responderStance,
        temperature: structure.temperature,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// APIルート用エントリポイント（KVからデータ読み込み → パイプライン → 永続化）
// ---------------------------------------------------------------------------

/**
 * APIルートから呼ばれるメインエントリポイント。
 * KVストアからプロフィール・関係性・好感度を読み込み、
 * パイプラインを実行し、結果を永続化して返す。
 */
export async function runConversationFromApi(
  args: RunConversationApiArgs,
): Promise<RunConversationApiResult> {
  let threadId: string | undefined;
  let participants: [string, string];
  if ("threadId" in args) {
    threadId = args.threadId;
    participants = await resolveParticipantsFromThread(args.threadId);
  } else {
    participants = args.participants;
  }

  // 1) プロフィール読み込み
  const characters = await loadCharacterProfiles(participants);
  if (!characters[participants[0]] || !characters[participants[1]]) {
    throw new Error("[runConversationFromApi] Could not load profiles for one or both participants.");
  }

  // 2) 関係性読み込み
  let relationType: string | undefined;
  try {
    relationType = await loadRelationTypeForPair(participants);
  } catch (error) {
    console.warn("[runConversationFromApi] Failed to load relation.", error);
  }
  if (relationType === "none") {
    throw new Error("[runConversationFromApi] Conversation aborted because relation is 'none'.");
  }

  // 3) 好感度読み込み
  let feelings = { aToB: { label: "none", score: 0 }, bToA: { label: "none", score: 0 } };
  try {
    feelings = await loadFeelingsForPair(participants);
  } catch (error) {
    console.warn("[runConversationFromApi] Failed to load feelings.", error);
  }

  // 4) 環境決定
  const environment = determineEnvironment();

  // 5) パイプライン実行
  const result = await runConversation({
    participants,
    characters,
    relation: {
      type: (relationType ?? "acquaintance") as RunConversationArgs["relation"]["type"],
      feelingAtoB: feelings.aToB,
      feelingBtoA: feelings.bToA,
    },
    environment,
    threadId,
    // TODO: 以下は今後バッチ生成機能から取得
    // previousMemory, recentSnippets, knowledgeByA, knowledgeByB, recentTopics
  });

  // 6) 評価
  const evalInput: EvalInput = {
    threadId: result.threadId,
    participants,
    lines: result.output.lines,
    meta: {
      tags: result.output.meta.tags,
      signals: result.output.meta.signals,
      qualityHints: result.output.meta.qualityHints,
    },
  };
  const evalResult = evaluateConversation(evalInput);

  // 7) 永続化
  // 新出力はv1の GptConversationOutput と構造的に互換
  const { eventId } = await persistConversation({
    gptOut: result.output as unknown as GptConversationOutput,
    evalResult,
  });

  return { eventId, threadId: result.threadId };
}
