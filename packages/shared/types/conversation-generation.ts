// packages/shared/types/conversation-generation.ts
// 会話生成パイプライン固有の型定義
import { z } from "zod";

// ---------------------------------------------------------------------------
// 口調プロファイル（SpeechProfile）
// ---------------------------------------------------------------------------

export const speechProfileSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  endings: z.array(z.string()).min(1),          // 語尾パターン
  frequentPhrases: z.array(z.string()).default([]), // よく使う表現
  avoidedPhrases: z.array(z.string()).default([]),  // 避ける表現
  examples: z.array(z.string()).min(1),          // 例文（1文以上）
});
export type SpeechProfile = z.infer<typeof speechProfileSchema>;

// ---------------------------------------------------------------------------
// 性格特性
// ---------------------------------------------------------------------------

export const traitKeyEnum = z.enum([
  "sociability",
  "empathy",
  "stubbornness",
  "activity",
  "expressiveness",
]);
export type TraitKey = z.infer<typeof traitKeyEnum>;

export const traitTierEnum = z.enum(["low", "neutral", "high"]);
export type TraitTier = z.infer<typeof traitTierEnum>;

export const traitsSchema = z.object({
  sociability: z.number().int().min(1).max(5).default(3),
  empathy: z.number().int().min(1).max(5).default(3),
  stubbornness: z.number().int().min(1).max(5).default(3),
  activity: z.number().int().min(1).max(5).default(3),
  expressiveness: z.number().int().min(1).max(5).default(3),
});
export type Traits = z.infer<typeof traitsSchema>;

// ---------------------------------------------------------------------------
// 感情スタンス
// ---------------------------------------------------------------------------

export const emotionalStanceEnum = z.enum([
  "enthusiastic",    // 乗り気。話を広げる
  "agreeable",       // 穏やかに同調
  "reluctant",       // 面倒だが付き合う
  "indifferent",     // 興味薄。短く返す
  "confrontational", // 反論・突っかかり気味
]);
export type EmotionalStance = z.infer<typeof emotionalStanceEnum>;

// ---------------------------------------------------------------------------
// 温度感
// ---------------------------------------------------------------------------

export const conversationTemperatureEnum = z.enum([
  "warm",      // 和やかに盛り上がる
  "lukewarm",  // ぎこちない
  "neutral",   // 普通
  "tense",     // 緊張感がある
]);
export type ConversationTemperature = z.infer<typeof conversationTemperatureEnum>;

// ---------------------------------------------------------------------------
// 話題候補
// ---------------------------------------------------------------------------

export const topicSourceEnum = z.enum([
  "shared_interest",    // 共通の趣味
  "personal_interest",  // 片方の趣味
  "continuation",       // 前回の続き
  "snippet",            // 共有体験
  "third_party",        // 第三者の噂
  "self_experience",    // 自分の最近の出来事
  "heart_to_heart",     // 自己開示・質問
  "small_talk",         // 世間話（旧 environmental）
  "seasonal",           // 季節・時事
]);
export type TopicSource = z.infer<typeof topicSourceEnum>;

export const topicCandidateSchema = z.object({
  source: topicSourceEnum,
  label: z.string().min(1),
  detail: z.string().optional(),
  score: z.number(),
  /** third_party 候補の場合、対象キャラの ID */
  aboutCharacterId: z.string().uuid().optional(),
});
export type TopicCandidate = z.infer<typeof topicCandidateSchema>;

export const selectedTopicSchema = z.object({
  source: topicSourceEnum,
  label: z.string().min(1),
  detail: z.string().optional(),
  // third_party 用
  thirdPartyContext: z.object({
    characterName: z.string(),
    knownFacts: z.array(z.string()),
    listenerKnowsCharacter: z.boolean(),
  }).optional(),
});
export type SelectedTopic = z.infer<typeof selectedTopicSchema>;

// ---------------------------------------------------------------------------
// 会話構造（コードで決定してLLMに渡す指示）
// ---------------------------------------------------------------------------

export const conversationStructureSchema = z.object({
  initiatorId: z.string().uuid(),           // 主導者
  initiatorName: z.string(),
  responderId: z.string().uuid(),           // 追随者
  responderName: z.string(),
  initiatorStance: emotionalStanceEnum,
  responderStance: emotionalStanceEnum,
  temperature: conversationTemperatureEnum,
  initiatorTurnLength: z.string(),          // "1〜2文"
  responderTurnLength: z.string(),          // "1文以内"
});
export type ConversationStructure = z.infer<typeof conversationStructureSchema>;

// ---------------------------------------------------------------------------
// 会話記憶（LLM出力 → 保存 → 次回入力）
// ---------------------------------------------------------------------------

export const conversationMemorySchema = z.object({
  summary: z.string().min(1),
  topicsCovered: z.array(z.string()),
  unresolvedThreads: z.array(z.string()),
  knowledgeGained: z.array(z.object({
    about: z.string().uuid(),
    fact: z.string().min(1),
  })),
});
export type ConversationMemory = z.infer<typeof conversationMemorySchema>;

// ---------------------------------------------------------------------------
// 出力スキーマ（LLMが返すJSON構造）
// ---------------------------------------------------------------------------

export const conversationMetaSchema = z.object({
  tags: z.array(z.string()).max(12),
  qualityHints: z.object({
    turnBalance: z.enum(["balanced", "skewed"]),
    tone: z.string(),
  }),
  debug: z.array(z.string()),
  memory: conversationMemorySchema,
});
export type ConversationMeta = z.infer<typeof conversationMetaSchema>;

export const conversationOutputSchema = z.object({
  threadId: z.string().uuid(),
  participants: z.tuple([z.string().uuid(), z.string().uuid()]),
  topic: z.string().min(1),
  lines: z.array(z.object({
    speaker: z.string().uuid(),
    text: z.string().min(1),
  })).min(1),
  meta: conversationMetaSchema,
});
export type ConversationOutput = z.infer<typeof conversationOutputSchema>;

// ---------------------------------------------------------------------------
// 共有スニペット
// ---------------------------------------------------------------------------

export const snippetSourceEnum = z.enum(["routine", "coincidence", "environment"]);
export type SnippetSource = z.infer<typeof snippetSourceEnum>;

export const sharedSnippetSchema = z.object({
  id: z.string().uuid(),
  participants: z.tuple([z.string().uuid(), z.string().uuid()]),
  text: z.string().min(1),
  occurredAt: z.string().datetime(),
  source: snippetSourceEnum,
});
export type SharedSnippet = z.infer<typeof sharedSnippetSchema>;

// ---------------------------------------------------------------------------
// キャラ「最近の出来事」（定期バッチ生成）
// ---------------------------------------------------------------------------

export const recentEventSchema = z.object({
  id: z.string().uuid(),
  characterId: z.string().uuid(),
  fact: z.string().min(1),
  generatedAt: z.string().datetime(),
  sharedWith: z.array(z.string().uuid()).default([]),
});
export type RecentEvent = z.infer<typeof recentEventSchema>;

// ---------------------------------------------------------------------------
// オフスクリーン知識（伝播された知識）
// ---------------------------------------------------------------------------

export const offscreenKnowledgeSchema = z.object({
  id: z.string().uuid(),
  learnedBy: z.string().uuid(),      // 知識を受け取ったキャラ
  about: z.string().uuid(),          // 知識の対象キャラ
  fact: z.string().min(1),
  source: z.enum(["offscreen", "conversation", "profile"]),
  learnedAt: z.string().datetime(),
});
export type OffscreenKnowledge = z.infer<typeof offscreenKnowledgeSchema>;
