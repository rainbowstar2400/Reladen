// apps/web/lib/conversation/run-conversation-v2.ts
// v2 会話生成パイプライン オーケストレータ
//
// 1. 入力データ収集（キャラ、関係性、スニペット、記憶等）
// 2. 動機生成（話題選定）
// 3. 会話構造決定（主導権、スタンス、温度感）
// 4. プロンプト構築 + GPT呼び出し + 検証 + リトライ
// 5. 結果返却

import type {
  ConversationOutputV2,
  ConversationMemory,
  SharedSnippet,
  OffscreenKnowledge,
  SpeechProfile,
  Traits,
} from "@repo/shared/types/conversation-v2";
import { selectTopic, type TopicSelectionInput, type CharacterContext } from "@repo/shared/logic/topic-selection";
import { buildConversationStructure, type StructureInput } from "@repo/shared/logic/conversation-structure";
import { callGptForConversationV2, type CallGptV2Result } from "@/lib/gpt/call-gpt-for-conversation-v2";
import type { PromptInputV2, CharacterProfileV2 } from "@repo/shared/gpt/prompts/conversation-prompt-v2";
import { newId } from "@/lib/newId";

// ---------------------------------------------------------------------------
// 入力型
// ---------------------------------------------------------------------------

/** v2パイプラインの入力 */
export type RunConversationV2Args = {
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

/** v2パイプラインの結果 */
export type RunConversationV2Result = {
  threadId: string;
  output: ConversationOutputV2;
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

function toCharacterProfileV2(profile: RunCharacterProfile): CharacterProfileV2 {
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
// パイプライン
// ---------------------------------------------------------------------------

export async function runConversationV2(
  args: RunConversationV2Args,
): Promise<RunConversationV2Result> {
  const [aId, bId] = args.participants;
  const charA = args.characters[aId];
  const charB = args.characters[bId];

  if (!charA || !charB) {
    throw new Error(`[runConversationV2] Missing character profile for participants.`);
  }

  // 関係性が "none" なら会話しない
  if (args.relation.type === "none") {
    throw new Error("[runConversationV2] Conversation aborted because relation is 'none'.");
  }

  const threadId = args.threadId ?? newId();

  // --- 1. 話題選定 ---
  const topicInput: TopicSelectionInput = {
    characterA: toCharacterContext(charA),
    characterB: toCharacterContext(charB),
    relation: args.relation,
    previousMemory: args.previousMemory ?? null,
    recentSnippets: args.recentSnippets ?? [],
    knowledgeByA: args.knowledgeByA ?? [],
    knowledgeByB: args.knowledgeByB ?? [],
    recentTopics: args.recentTopics ?? [],
    environment: args.environment,
  };

  // 主導者の仮判定（話題選定にinitiatorsの興味が影響するため）
  const ctxA = toCharacterContext(charA);
  const ctxB = toCharacterContext(charB);
  const { selected: topic, candidates: topicCandidates } = selectTopic(topicInput, ctxA, ctxB);

  // --- 2. 会話構造決定 ---
  const structureInput: StructureInput = {
    characterA: ctxA,
    characterB: ctxB,
    relation: args.relation,
    topic,
  };
  const structure = buildConversationStructure(structureInput);

  // --- 3. プロンプト構築 + GPT呼び出し ---
  const promptInput: PromptInputV2 = {
    characters: [toCharacterProfileV2(charA), toCharacterProfileV2(charB)],
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

  const gptResult: CallGptV2Result = await callGptForConversationV2(
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
