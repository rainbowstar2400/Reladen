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
import {
  selectTopic,
  SMALL_TALK_CATEGORY_DETAIL,
  SMALL_TALK_CATEGORY_LABEL,
  type TopicSelectionInput,
  type CharacterContext,
} from "@repo/shared/logic/topic-selection";
import { buildConversationStructure, determineInitiator, type StructureInput } from "@repo/shared/logic/conversation-structure";
import { shouldGeneratePromise, determineConversationType, type ConversationType } from "@repo/shared/logic/promise";
import { checkRelationTransition, computeImpressionOnTransition, type TransitionResult } from "@repo/shared/logic/relation-transition";
import { callGptForConversation, type CallGptResult } from "@/lib/gpt/call-gpt-for-conversation";
import { callGptForSituation } from "@/lib/gpt/call-gpt-for-situation";
import { callGptForNickname } from "@/lib/gpt/call-gpt-for-nickname";
import { shouldGenerateNickname, type NicknameGenerationInput, type NicknameTendency } from "@repo/shared/logic/nickname";
import { DEFAULT_FEELING_SCORE } from "@repo/shared/types";
import type { PromptInput, CharacterProfile } from "@repo/shared/gpt/prompts/conversation-prompt";
import { newId } from "@/lib/newId";
import { KvUnauthenticatedError, listKV as listAny, putKV as putAny } from "@/lib/db/kv-server";
import { extractSpeechProfile } from "@/lib/gpt/extract-speech-profile";
import { generateSnippetsIfStale } from "@/lib/batch/generate-snippets";
import { generateRecentEventsIfStale } from "@/lib/batch/generate-recent-events";
import { persistConversation } from "@/lib/persist/persist-conversation";
import { evaluateConversation, type EvalInput } from "@/lib/evaluation/evaluate-conversation";
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
    familySubType?: string | null;
    feelingAtoB: { label: string; score: number };
    feelingBtoA: { label: string; score: number };
  };
  /** 環境 */
  environment: { timeOfDay: string; weather?: string; place?: string };
  /** ゲーム内日付（例: "3月17日"） */
  gameDate?: string;
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
  /** キャラクターID → 名前のマップ（third_party 名前解決用） */
  nameMap?: Map<string, string>;
  /** 各キャラの最近の出来事（self_experience用） */
  recentEventsByCharacter?: Record<string, import("@repo/shared/types/conversation-generation").RecentEvent[]>;
  /** 現在の日付（seasonal用、例: "2026-03-18"） */
  currentDate?: string;
  /** シチュエーション描写（GPT生成済み） */
  situation?: string;
  /** ニックネーム情報（D-3） */
  nicknames?: { aCallsB?: string | null; bCallsA?: string | null };
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
  /** 約束フラグ（trueなら約束生成会話） */
  promiseFlag: boolean;
  debug: {
    topicCandidates: Array<{ source: string; label: string; score: number }>;
    selectedTopic: { source: string; label: string };
    structure: {
      initiatorId: string;
      initiator: string;
      responderId: string;
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

function resolveFavorScoreByInitiator(
  participants: [string, string],
  relation: RunConversationArgs["relation"],
  initiatorId: string,
): number {
  const [aId, bId] = participants;
  if (initiatorId === aId) return relation.feelingAtoB.score;
  if (initiatorId === bId) return relation.feelingBtoA.score;
  return relation.feelingAtoB.score;
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
  recent_deltas?: number[];
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
): Promise<{ profiles: Record<string, RunCharacterProfile>; nameMap: Map<string, string> }> {
  const uniqueIds = Array.from(new Set(participantIds));
  if (uniqueIds.length === 0) return { profiles: {}, nameMap: new Map() };

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
  const nameMap = new Map<string, string>();
  if (!Array.isArray(rows)) return { profiles: dict, nameMap };

  // 全住民の名前マップを構築（third_party 名前解決用）
  for (const raw of rows) {
    const rid = typeof raw?.id === "string" ? raw.id : undefined;
    if (!rid || Boolean((raw as any)?.deleted)) continue;
    const rname = typeof (raw as any)?.name === "string" ? (raw as any).name : undefined;
    if (rname) nameMap.set(rid, rname);
  }

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

    // 口調プリセット → SpeechProfile に変換（キャッシュ or LLM抽出）
    const speechPresetId = typeof r.speech_preset === "string" ? r.speech_preset : null;
    const speechPreset = speechPresetId ? presetMap.get(speechPresetId) : undefined;
    let speechProfile: SpeechProfile | null = null;
    if (speechPreset) {
      const label = typeof (speechPreset as any).label === "string" ? (speechPreset as any).label : "";
      const description = typeof (speechPreset as any).description === "string" ? (speechPreset as any).description : "";
      const example = typeof (speechPreset as any).example === "string" ? (speechPreset as any).example : "";
      if (label && description) {
        // speech_profile_data にキャッシュがあればそれを使う
        const cached = (speechPreset as any).speech_profile_data;
        if (cached && typeof cached === "object" && Array.isArray(cached.endings) && cached.endings.length > 0) {
          speechProfile = {
            label,
            description,
            endings: cached.endings,
            frequentPhrases: cached.frequentPhrases ?? [],
            avoidedPhrases: cached.avoidedPhrases ?? [],
            examples: cached.examples ?? (example ? [example] : [`（${label}の口調）`]),
          };
        } else {
          // キャッシュなし → LLM で抽出して保存
          try {
            const extracted = await extractSpeechProfile({ label, description, example });
            speechProfile = { label, description, ...extracted };
            // キャッシュ保存（非同期、失敗しても続行）
            putAny("presets", {
              id: speechPresetId,
              speech_profile_data: extracted,
            }).catch((err) => {
              console.warn("[loadCharacterProfiles] Failed to cache speech_profile_data.", err);
            });
          } catch (err) {
            console.warn("[loadCharacterProfiles] Failed to extract speech profile, using fallback.", err);
            speechProfile = {
              label,
              description,
              endings: [],
              frequentPhrases: [],
              avoidedPhrases: [],
              examples: example ? [example] : [`（${label}の口調）`],
            };
          }
        }
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

  return { profiles: dict, nameMap };
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
async function loadRelationForPair(
  participants: [string, string],
): Promise<{ type: string; familySubType?: string | null } | undefined> {
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

  const match = matches[0];
  if (!match?.type) return undefined;
  return {
    type: match.type,
    familySubType: (match as any).family_sub_type ?? null,
  };
}

type FeelingData = { label: string; score: number; recentDeltas: number[] };

function normalizeFeelingScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_FEELING_SCORE;
  }
  return value;
}

/** 好感度を KV から読み込み */
async function loadFeelingsForPair(
  participants: [string, string],
): Promise<{ aToB: FeelingData; bToA: FeelingData }> {
  const rows = (await listAny("feelings")) as unknown as FeelingRow[] | null;
  const [a, b] = participants;

  const pickLatest = (fromId: string, toId: string): FeelingData => {
    if (!Array.isArray(rows)) return { label: "none", score: DEFAULT_FEELING_SCORE, recentDeltas: [] };
    const found = rows
      .filter((row) => {
        if (!row || row.deleted) return false;
        const pair = pickFeelingPair(row);
        return pair.fromId === fromId && pair.toId === toId;
      })
      .sort((lhs, rhs) => toUpdatedAtMillis(rhs) - toUpdatedAtMillis(lhs))[0];
    return {
      label: typeof found?.label === "string" ? found.label : "none",
      score: normalizeFeelingScore(found?.score),
      recentDeltas: Array.isArray(found?.recent_deltas) ? found.recent_deltas : [],
    };
  };

  return { aToB: pickLatest(a, b), bToA: pickLatest(b, a) };
}

// ---------------------------------------------------------------------------
// 会話履歴読み込み（previousMemory + recentTopics）
// ---------------------------------------------------------------------------

/**
 * 同ペアの過去の会話イベントから、前回の記憶と最近の話題を読み込む。
 * 1回の listAny("events") で両方を解決する。
 */
async function loadConversationHistory(
  participants: [string, string],
): Promise<{
  previousMemory: ConversationMemory | null;
  recentTopics: string[];
  recentSituations: string[];
}> {
  let allEvents: Array<Record<string, any>> | null = null;
  try {
    allEvents = (await listAny("events")) as unknown as Array<Record<string, any>> | null;
  } catch (error) {
    console.warn("[loadConversationHistory] Failed to load events.", error);
    return { previousMemory: null, recentTopics: [], recentSituations: [] };
  }
  if (!Array.isArray(allEvents)) return { previousMemory: null, recentTopics: [], recentSituations: [] };

  const [a, b] = participants;
  const pairConvEvents = allEvents
    .filter((e) => {
      if (!e || e.deleted || e.kind !== "conversation") return false;
      const p = e.payload?.participants;
      if (!Array.isArray(p) || p.length !== 2) return false;
      return (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a);
    })
    .sort((lhs, rhs) => toUpdatedAtMillis(rhs) - toUpdatedAtMillis(lhs));

  // previousMemory: 最新イベントの memory を取得
  const latestMemory = pairConvEvents[0]?.payload?.meta?.memory;
  const previousMemory: ConversationMemory | null =
    latestMemory &&
    typeof latestMemory === "object" &&
    typeof latestMemory.summary === "string" &&
    latestMemory.summary.length > 0
      ? (latestMemory as ConversationMemory)
      : null;

  // recentTopics: 直近5件のイベントから話題を集約
  const recentTopics: string[] = [];
  const recentSituations: string[] = [];
  for (const e of pairConvEvents.slice(0, 5)) {
    const covered = e.payload?.meta?.memory?.topicsCovered;
    if (Array.isArray(covered)) {
      for (const t of covered) {
        if (typeof t === "string" && !recentTopics.includes(t)) {
          recentTopics.push(t);
        }
      }
    }

    const situation = e.payload?.situation;
    if (typeof situation === "string" && situation.length > 0 && !recentSituations.includes(situation)) {
      recentSituations.push(situation);
    }
  }

  return { previousMemory, recentTopics, recentSituations };
}

// ---------------------------------------------------------------------------
// 共有スニペット読み込み
// ---------------------------------------------------------------------------

/**
 * 同ペアの直近24時間のスニペットを SharedSnippet 型で返す。
 */
async function loadRecentSnippets(
  participants: [string, string],
): Promise<SharedSnippet[]> {
  let rows: Array<Record<string, any>> | null = null;
  try {
    rows = (await listAny("shared_snippets")) as unknown as Array<Record<string, any>> | null;
  } catch (error) {
    console.warn("[loadRecentSnippets] Failed to load shared_snippets.", error);
    return [];
  }
  if (!Array.isArray(rows)) return [];

  const [a, b] = participants;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  return rows
    .filter((s) => {
      if (!s || s.deleted) return false;
      const pa = s.participant_a;
      const pb = s.participant_b;
      if (!pa || !pb) return false;
      if (!((pa === a && pb === b) || (pa === b && pb === a))) return false;
      const ts = Date.parse(s.occurred_at ?? s.updated_at ?? "");
      return Number.isFinite(ts) && ts >= cutoff;
    })
    .map((s) => ({
      id: s.id ?? "",
      participants: [s.participant_a, s.participant_b] as [string, string],
      text: s.text ?? "",
      occurredAt: s.occurred_at ?? new Date().toISOString(),
      source: s.source ?? "coincidence",
    }))
    .sort((lhs, rhs) => Date.parse(rhs.occurredAt) - Date.parse(lhs.occurredAt));
}

// ---------------------------------------------------------------------------
// オフスクリーン知識読み込み
// ---------------------------------------------------------------------------

/**
 * 指定キャラクターが他キャラについて持つオフスクリーン知識を返す。
 */
async function loadOffscreenKnowledge(
  characterId: string,
): Promise<OffscreenKnowledge[]> {
  let rows: Array<Record<string, any>> | null = null;
  try {
    rows = (await listAny("offscreen_knowledge")) as unknown as Array<Record<string, any>> | null;
  } catch (error) {
    console.warn("[loadOffscreenKnowledge] Failed to load offscreen_knowledge.", error);
    return [];
  }
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((k) => {
      if (!k || k.deleted) return false;
      return k.learned_by === characterId;
    })
    .map((k) => ({
      id: k.id ?? "",
      learnedBy: k.learned_by ?? "",
      about: k.about ?? "",
      fact: k.fact ?? "",
      source: k.source ?? "offscreen",
      learnedAt: k.learned_at ?? new Date().toISOString(),
    }));
}

/** 指定キャラクターの最近の出来事を KV から読み込み */
async function loadRecentEventsForCharacter(
  characterId: string,
): Promise<import("@repo/shared/types/conversation-generation").RecentEvent[]> {
  let rows: Array<Record<string, any>> | null = null;
  try {
    rows = (await listAny("recent_events")) as unknown as Array<Record<string, any>> | null;
  } catch (error) {
    console.warn("[loadRecentEventsForCharacter] Failed to load recent_events.", error);
    return [];
  }
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((r) => {
      if (!r || r.deleted) return false;
      return r.character_id === characterId;
    })
    .map((r) => ({
      id: r.id ?? "",
      characterId: r.character_id ?? "",
      fact: r.fact ?? "",
      generatedAt: r.generated_at ?? new Date().toISOString(),
      sharedWith: Array.isArray(r.shared_with) ? r.shared_with : [],
    }));
}

/** 時間帯に基づく環境情報を決定 */
function determineEnvironment(): { timeOfDay: string } {
  const now = new Date();
  const hourText = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    hour12: false,
  }).format(now);
  const hour = Number(hourText);
  const effectiveHour = Number.isFinite(hour) ? hour : now.getUTCHours();
  if (effectiveHour >= 6 && effectiveHour < 11) return { timeOfDay: "朝" };
  if (effectiveHour >= 11 && effectiveHour < 16) return { timeOfDay: "昼" };
  if (effectiveHour >= 16 && effectiveHour < 20) return { timeOfDay: "夕方" };
  return { timeOfDay: "夜" };
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
    source: "small_talk",
    label: SMALL_TALK_CATEGORY_LABEL,
    detail: SMALL_TALK_CATEGORY_DETAIL,
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
    situation: args.situation,
    nameMap: args.nameMap,
    recentEventsA: args.recentEventsByCharacter?.[seedInitiator.id],
    currentDate: args.currentDate,
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

  // --- 2.5. 約束フラグ抽選 ---
  // 約束抽選は「主導者 -> 相手」の好感度軸で確率計算する。
  const initiatorFavorScore = resolveFavorScoreByInitiator(
    args.participants,
    args.relation,
    structure.initiatorId,
  );
  const isContinuation = topic.source === 'continuation';
  const promiseFlag = !isContinuation && shouldGeneratePromise({
    relationType: args.relation.type,
    topicSource: topic.source,
    favorScore: initiatorFavorScore,
  });
  const conversationType = determineConversationType(topic.source, promiseFlag);

  // --- 3. プロンプト構築 + GPT呼び出し ---
  const promptInput: PromptInput = {
    characters: [toCharacterProfile(charA), toCharacterProfile(charB)],
    relation: args.relation,
    structure,
    topic,
    environment: args.environment,
    gameDate: args.gameDate,
    recentSnippets: args.recentSnippets ?? [],
    previousMemory: args.previousMemory ?? null,
    threadId,
    situation: args.situation,
    conversationType,
    nicknames: args.nicknames,
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
    promiseFlag,
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
        initiatorId: structure.initiatorId,
        initiator: structure.initiatorName,
        responderId: structure.responderId,
        responder: structure.responderName,
        initiatorStance: structure.initiatorStance,
        responderStance: structure.responderStance,
        temperature: structure.temperature,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// 関係遷移の永続化
// ---------------------------------------------------------------------------

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ---------------------------------------------------------------------------
// D-3: ニックネーム自動生成
// ---------------------------------------------------------------------------

type NicknameRow = {
  id?: string;
  from_id?: string;
  to_id?: string;
  fromId?: string;
  toId?: string;
  nickname?: string;
  locked?: boolean;
  deleted?: boolean;
};

async function generateNicknamesOnTransition(params: {
  participants: [string, string];
  trigger: 'initial' | 'upgrade';
  newRelation: string;
  now: string;
}): Promise<void> {
  const [a, b] = params.participants;

  // 住人情報を取得（nicknameTendency 含む）
  const residents = (await listAny("residents")) as unknown as Array<Record<string, any>> | null;
  if (!Array.isArray(residents)) return;

  const resA = residents.find((r) => r?.id === a && !r?.deleted);
  const resB = residents.find((r) => r?.id === b && !r?.deleted);
  if (!resA || !resB) return;

  // 既存ニックネーム確認（locked チェック）
  const nicknames = (await listAny("nicknames")) as unknown as NicknameRow[] | null;
  const existingAtoB = Array.isArray(nicknames)
    ? nicknames.find((n) => {
        const from = n.from_id ?? n.fromId;
        const to = n.to_id ?? n.toId;
        return from === a && to === b && !n.deleted;
      })
    : undefined;
  const existingBtoA = Array.isArray(nicknames)
    ? nicknames.find((n) => {
        const from = n.from_id ?? n.fromId;
        const to = n.to_id ?? n.toId;
        return from === b && to === a && !n.deleted;
      })
    : undefined;

  // 両方 locked なら何もしない
  const lockedAtoB = existingAtoB?.locked === true;
  const lockedBtoA = existingBtoA?.locked === true;
  if (lockedAtoB && lockedBtoA) return;

  // GPT で生成
  const input: NicknameGenerationInput = {
    trigger: params.trigger,
    characterA: {
      id: a,
      name: resA.name ?? '不明',
      gender: resA.gender ?? null,
      age: typeof resA.age === 'number' ? resA.age : null,
      nicknameTendency: (resA.nickname_tendency ?? resA.nicknameTendency ?? 'san') as NicknameTendency,
    },
    characterB: {
      id: b,
      name: resB.name ?? '不明',
      gender: resB.gender ?? null,
      age: typeof resB.age === 'number' ? resB.age : null,
      nicknameTendency: (resB.nickname_tendency ?? resB.nicknameTendency ?? 'san') as NicknameTendency,
    },
    newRelation: params.newRelation,
    currentNicknameAtoB: existingAtoB?.nickname ?? null,
    currentNicknameBtoA: existingBtoA?.nickname ?? null,
  };

  const result = await callGptForNickname(input);

  // 保存（locked でないもののみ）
  if (!lockedAtoB) {
    await putAny("nicknames", {
      id: existingAtoB?.id ?? newId(),
      from_id: a,
      to_id: b,
      nickname: result.nicknameAtoB,
      locked: false,
      updated_at: params.now,
      deleted: false,
    });
  }
  if (!lockedBtoA) {
    await putAny("nicknames", {
      id: existingBtoA?.id ?? newId(),
      from_id: b,
      to_id: a,
      nickname: result.nicknameBtoA,
      locked: false,
      updated_at: params.now,
      deleted: false,
    });
  }
}

async function persistTransitionResult(params: {
  participants: [string, string];
  currentRelation: string;
  transition: TransitionResult;
  favorA: number;
  favorB: number;
  currentImpressionA: import("@repo/shared/types/conversation").ImpressionBase;
  currentImpressionB: import("@repo/shared/types/conversation").ImpressionBase;
}): Promise<void> {
  const [a, b] = params.participants;
  const now = new Date().toISOString();

  if (params.transition.type === 'observation') {
    const { newRelation, event } = params.transition;

    // 印象リセット算出
    const { newImpressionA, newImpressionB } = computeImpressionOnTransition({
      currentRelation: params.currentRelation,
      newRelation,
      favorA: params.favorA,
      favorB: params.favorB,
      currentImpressionA: params.currentImpressionA,
      currentImpressionB: params.currentImpressionB,
    });

    // relations テーブル更新
    const relations = (await listAny("relations")) as unknown as RelationRow[] | null;
    if (Array.isArray(relations)) {
      const match = relations.find((rel) => {
        if (!rel || rel.deleted) return false;
        const { aId, bId } = pickRelationPair(rel);
        return (aId === a && bId === b) || (aId === b && bId === a);
      });
      if (match) {
        await putAny("relations", {
          ...(match as any),
          type: newRelation,
          updated_at: now,
        });
      }
    }

    // feelings の印象リセット
    const feelings = (await listAny("feelings")) as unknown as FeelingRow[] | null;
    if (Array.isArray(feelings)) {
      const fAB = feelings.find((f) => {
        const pair = pickFeelingPair(f);
        return pair.fromId === a && pair.toId === b && !f.deleted;
      });
      const fBA = feelings.find((f) => {
        const pair = pickFeelingPair(f);
        return pair.fromId === b && pair.toId === a && !f.deleted;
      });
      if (fAB) {
        await putAny("feelings", { ...(fAB as any), label: newImpressionA, updated_at: now });
      }
      if (fBA) {
        await putAny("feelings", { ...(fBA as any), label: newImpressionB, updated_at: now });
      }
    }

    // system イベント記録
    await putAny("events", {
      id: newId(),
      kind: "system",
      updated_at: now,
      deleted: false,
      payload: {
        type: "relation_transition",
        subType: event,
        participants: [a, b],
        from: params.currentRelation,
        to: newRelation,
      },
    } as any);

    // D-3: ニックネーム自動生成
    const nicknameTrigger = shouldGenerateNickname(params.currentRelation, newRelation);
    if (nicknameTrigger) {
      try {
        await generateNicknamesOnTransition({
          participants: [a, b],
          trigger: nicknameTrigger,
          newRelation,
          now,
        });
      } catch (error) {
        console.warn("[persistTransitionResult] Failed to generate nicknames.", error);
      }
    }
  }

  if (params.transition.type === 'intervention') {
    const { trigger, residentId, targetId } = params.transition;

    // relation_trigger イベントとして記録（相談システムで処理）
    await putAny("events", {
      id: newId(),
      kind: "relation_trigger",
      updated_at: now,
      deleted: false,
      payload: {
        trigger,
        residentId,
        targetId,
        participants: [residentId, targetId],
        currentRelation: params.currentRelation,
        handled: false,
      },
    } as any);
  }
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
  const { profiles: characters, nameMap } = await loadCharacterProfiles(participants);
  if (!characters[participants[0]] || !characters[participants[1]]) {
    throw new Error("[runConversationFromApi] Could not load profiles for one or both participants.");
  }

  // 2) 関係性読み込み
  let relationData: { type: string; familySubType?: string | null } | undefined;
  try {
    relationData = await loadRelationForPair(participants);
  } catch (error) {
    console.warn("[runConversationFromApi] Failed to load relation.", error);
  }
  const relationType = relationData?.type;
  if (relationType === "none") {
    throw new Error("[runConversationFromApi] Conversation aborted because relation is 'none'.");
  }

  // 3) 好感度読み込み
  let feelings: { aToB: FeelingData; bToA: FeelingData } = {
    aToB: { label: "none", score: DEFAULT_FEELING_SCORE, recentDeltas: [] },
    bToA: { label: "none", score: DEFAULT_FEELING_SCORE, recentDeltas: [] },
  };
  try {
    feelings = await loadFeelingsForPair(participants);
  } catch (error) {
    console.warn("[runConversationFromApi] Failed to load feelings.", error);
  }

  // 4) 環境決定
  const environment = determineEnvironment();
  const now = new Date();
  const gameDate = `${now.getMonth() + 1}月${now.getDate()}日`;

  // 5) 会話履歴読み込み（previousMemory + recentTopics + recentSituations）
  const { previousMemory, recentTopics, recentSituations } = await loadConversationHistory(participants);

  // 6) バッチ生成（スニペット + 最近の出来事）
  try {
    await generateSnippetsIfStale();
  } catch (error) {
    console.warn("[runConversationFromApi] Failed to generate snippets.", error);
  }
  try {
    await generateRecentEventsIfStale();
  } catch (error) {
    console.warn("[runConversationFromApi] Failed to generate recent events.", error);
  }

  // 7) スニペット + オフスクリーン知識 + 最近の出来事の取得
  const recentSnippets = await loadRecentSnippets(participants);
  const [knowledgeByA, knowledgeByB, eventsA, eventsB] = await Promise.all([
    loadOffscreenKnowledge(participants[0]),
    loadOffscreenKnowledge(participants[1]),
    loadRecentEventsForCharacter(participants[0]),
    loadRecentEventsForCharacter(participants[1]),
  ]);

  // 7.5) ニックネーム読み込み（D-3: プロンプト注入用）
  let nicknameInfo: { aCallsB?: string | null; bCallsA?: string | null } | undefined;
  try {
    const nicknameRows = (await listAny("nicknames")) as unknown as NicknameRow[] | null;
    if (Array.isArray(nicknameRows)) {
      const [pa, pb] = participants;
      const aToB = nicknameRows.find((n) => {
        const from = n.from_id ?? n.fromId;
        const to = n.to_id ?? n.toId;
        return from === pa && to === pb && !n.deleted;
      });
      const bToA = nicknameRows.find((n) => {
        const from = n.from_id ?? n.fromId;
        const to = n.to_id ?? n.toId;
        return from === pb && to === pa && !n.deleted;
      });
      if (aToB?.nickname || bToA?.nickname) {
        nicknameInfo = {
          aCallsB: aToB?.nickname ?? null,
          bCallsA: bToA?.nickname ?? null,
        };
      }
    }
  } catch (error) {
    console.warn("[runConversationFromApi] Failed to load nicknames.", error);
  }

  // 8) シチュエーション生成（GPT）
  let situation: string | undefined;
  try {
    const charA = characters[participants[0]];
    const charB = characters[participants[1]];
    situation = await callGptForSituation({
      characterA: { name: charA.name, occupation: charA.occupation, interests: charA.interests },
      characterB: { name: charB.name, occupation: charB.occupation, interests: charB.interests },
      relationType: relationType ?? "acquaintance",
      timeOfDay: environment.timeOfDay,
      date: gameDate,
      recentSituations: recentSituations.slice(0, 5),
    });
  } catch (error) {
    console.warn("[runConversationFromApi] Failed to generate situation.", error);
  }

  // 9) パイプライン実行
  const result = await runConversation({
    participants,
    characters,
    relation: {
      type: (relationType ?? "acquaintance") as RunConversationArgs["relation"]["type"],
      familySubType: relationData?.familySubType ?? null,
      feelingAtoB: feelings.aToB,
      feelingBtoA: feelings.bToA,
    },
    environment,
    gameDate,
    threadId,
    previousMemory,
    recentTopics,
    recentSnippets,
    knowledgeByA,
    knowledgeByB,
    nameMap,
    recentEventsByCharacter: {
      [participants[0]]: eventsA,
      [participants[1]]: eventsB,
    },
    currentDate: now.toISOString().slice(0, 10),
    situation,
    nicknames: nicknameInfo,
  });

  // 10) 評価
  const evalInput: EvalInput = {
    threadId: result.threadId,
    participants,
    lines: result.output.lines,
    meta: {
      tags: result.output.meta.tags,
      qualityHints: result.output.meta.qualityHints,
    },
    // Phase 2: A-5 3層乗算用
    characterProfiles: Object.fromEntries(
      participants.map((id) => [id, {
        traits: characters[id].traits,
        mbti: characters[id].mbti,
      }]),
    ),
    stances: {
      [result.debug.structure.initiatorId]: result.debug.structure.initiatorStance,
      [result.debug.structure.responderId]: result.debug.structure.responderStance,
    },
    topicSource: result.debug.selectedTopic.source,
    topicInitiatorId: result.debug.structure.initiatorId,
    // Phase 4: A-7 約束フラグ
    promiseFlag: result.promiseFlag,
    // Phase 2: A-3 2系列制
    relationType: relationType ?? 'acquaintance',
    currentImpression: {
      aToB: feelings.aToB.label as import('@/lib/evaluation/weights').ImpressionBase,
      bToA: feelings.bToA.label as import('@/lib/evaluation/weights').ImpressionBase,
    },
    // Phase 2: A-4 3件窓
    recentDeltas: {
      aToB: feelings.aToB.recentDeltas,
      bToA: feelings.bToA.recentDeltas,
    },
  };
  const evalResult = evaluateConversation(evalInput);

  // 11) 永続化
  const { eventId } = await persistConversation({
    gptOut: result.output,
    evalResult,
    situation,
  });

  // 12) 関係遷移チェック（会話評価後・永続化後）
  const postFavorA = clampScore(feelings.aToB.score + Math.round(evalResult.deltas.aToB.favor));
  const postFavorB = clampScore(feelings.bToA.score + Math.round(evalResult.deltas.bToA.favor));
  const postImpressionA = evalResult.deltas.aToB.impressionState.base as import("@repo/shared/types/conversation").ImpressionBase;
  const postImpressionB = evalResult.deltas.bToA.impressionState.base as import("@repo/shared/types/conversation").ImpressionBase;

  const transition = checkRelationTransition({
    participantAId: participants[0],
    participantBId: participants[1],
    relationType: relationType ?? 'acquaintance',
    favorAtoB: postFavorA,
    favorBtoA: postFavorB,
    impressionAtoB: postImpressionA,
    impressionBtoA: postImpressionB,
    empathyA: characters[participants[0]]?.traits?.empathy,
    empathyB: characters[participants[1]]?.traits?.empathy,
  });

  if (transition.type !== 'none') {
    try {
      await persistTransitionResult({
        participants,
        currentRelation: relationType ?? 'acquaintance',
        transition,
        favorA: postFavorA,
        favorB: postFavorB,
        currentImpressionA: postImpressionA,
        currentImpressionB: postImpressionB,
      });
    } catch (error) {
      console.warn("[runConversationFromApi] Failed to persist relation transition.", error);
    }
  }

  return { eventId, threadId: result.threadId };
}
