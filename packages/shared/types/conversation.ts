// packages/shared/types/conversation.ts
import { z } from 'zod';
import { baseEntitySchema, BaseEntity } from './base';

// 印象（base）と special（気まずさ等）の分離
export const impressionBaseEnum = z.enum(['dislike', 'maybe_dislike', 'none', 'curious', 'maybe_like', 'like']);
export type ImpressionBase = z.infer<typeof impressionBaseEnum>;

export const impressionSpecialEnum = z.enum(['awkward']);
export type ImpressionSpecial = z.infer<typeof impressionSpecialEnum>;

export const impressionStateSchema = z.object({
  base: impressionBaseEnum,
  special: impressionSpecialEnum.nullable().optional(),
  baseBeforeSpecial: impressionBaseEnum.nullable().optional(),
});
export type ImpressionState = z.infer<typeof impressionStateSchema>;

export const experienceSourceTypeEnum = z.enum([
  'lifestyle',
  'work',
  'interpersonal',
  'environment',
]);
export type ExperienceSourceType = z.infer<typeof experienceSourceTypeEnum>;

export const experienceAwarenessEnum = z.enum(['direct', 'witnessed', 'heard']);
export type ExperienceAwareness = z.infer<typeof experienceAwarenessEnum>;

export const hookIntentEnum = z.enum(['invite', 'share', 'complain', 'consult', 'reflect']);
export type HookIntent = z.infer<typeof hookIntentEnum>;

export const conversationExpressionStyleEnum = z.enum(['explicit', 'implicit', 'mixed']);
export type ConversationExpressionStyle = z.infer<typeof conversationExpressionStyleEnum>;

export const conversationFallbackModeEnum = z.enum(['experience', 'continuation', 'free']);
export type ConversationFallbackMode = z.infer<typeof conversationFallbackModeEnum>;

export const conversationLineSchema = z.object({
  speaker: z.string().uuid(),
  text: z.string().min(1),
});

export const conversationMetaSchema = z.object({
  tags: z.array(z.string()).max(12), // タグ辞書は最初10〜12程度
  newKnowledge: z.array(z.object({
    target: z.string().uuid(),
    key: z.string().min(1),
  })),
  signals: z.array(z.enum(['continue', 'close', 'park'])).optional(),
  qualityHints: z.object({
    turnBalance: z.enum(['balanced', 'skewed']).optional(),
    tone: z.string().optional(),
  }).optional(),
  anchorExperienceId: z.string().uuid().optional(),
  anchorSignature: z.string().optional(),
  grounded: z.boolean().optional(),
  groundingEvidence: z.array(z.string()).optional(),
  fallbackMode: conversationFallbackModeEnum.optional(),
});

export const conversationEventPayloadSchema = z.object({
  threadId: z.string().uuid(),
  participants: z.tuple([z.string().uuid(), z.string().uuid()]),
  topic: z.string().optional(),
  lines: z.array(conversationLineSchema).min(1),
  meta: conversationMetaSchema,
  deltas: z.object({
    // impression は互換のため number/string 両方を許容しつつ、
    // 新設の impressionState で base/special を運ぶ
    aToB: z.object({
      favor: z.number(),
      impression: z.union([impressionBaseEnum, z.number()]),
      impressionState: impressionStateSchema.optional(),
    }),
    bToA: z.object({
      favor: z.number(),
      impression: z.union([impressionBaseEnum, z.number()]),
      impressionState: impressionStateSchema.optional(),
    }),
  }),
  systemLine: z.string().min(1),
});

export type ConversationEventPayload = z.infer<typeof conversationEventPayloadSchema>;

// --- 他イベント（将来もここに追記） ---
export const favorChangeEventPayloadSchema = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  delta: z.number().int(),
  reason: z.string(),
});
export type FavorChangeEventPayload = z.infer<typeof favorChangeEventPayloadSchema>;

export const feelingChangeEventPayloadSchema = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  before: z.string(),
  after: z.string(),
  reason: z.string(),
});
export type FeelingChangeEventPayload = z.infer<typeof feelingChangeEventPayloadSchema>;

export const eventKindEnum = z.enum([
  'conversation', 'favor_change', 'feeling_change', 'system', 'consult',
]);

export const eventSchemaStrict = baseEntitySchema.and(
  z.object({
    kind: eventKindEnum,
    owner_id: z.string().uuid().nullable().optional(),
    payload: z.union([
      conversationEventPayloadSchema,
      favorChangeEventPayloadSchema,
      feelingChangeEventPayloadSchema,
      z.record(z.any()),  // system/consult は緩い開始
    ]),
  })
);

// 合成後の型
export type EventLogStrict = z.infer<typeof eventSchemaStrict>;

// --- 会話スレッド・通知の型 ---

export const topicThreadSchema = baseEntitySchema.extend({
  topic: z.string().optional(),
  participants: z.tuple([z.string().uuid(), z.string().uuid()]),
  status: z.enum(['ongoing', 'paused', 'done']).default('ongoing'),
  lastEventId: z.string().uuid().optional(),
});
export type TopicThread = z.infer<typeof topicThreadSchema>;

export const experienceEventSchema = baseEntitySchema.extend({
  ownerId: z.string().uuid().nullable().optional(),
  sourceType: experienceSourceTypeEnum,
  sourceRef: z.string().optional().nullable(),
  factSummary: z.string().min(1),
  factDetail: z.record(z.any()).optional().nullable(),
  tags: z.array(z.string()).default([]),
  significance: z.number().int().min(0).max(100),
  signature: z.string().min(1),
  occurredAt: z.string().datetime(),
});
export type ExperienceEvent = z.infer<typeof experienceEventSchema>;

export const residentExperienceSchema = baseEntitySchema.extend({
  ownerId: z.string().uuid().nullable().optional(),
  experienceId: z.string().uuid(),
  residentId: z.string().uuid(),
  awareness: experienceAwarenessEnum,
  appraisal: z.string().min(1),
  hookIntent: hookIntentEnum,
  confidence: z.number().int().min(0).max(100),
  salience: z.number().int().min(0).max(100),
  learnedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional().nullable(),
});
export type ResidentExperience = z.infer<typeof residentExperienceSchema>;

export const conversationBriefSchema = z.object({
  anchorExperienceId: z.string().uuid().optional(),
  anchorFact: z.string().min(1),
  anchorSignature: z.string().optional(),
  speakerAppraisal: z.array(z.object({
    speakerId: z.string().uuid(),
    text: z.string().min(1),
  })),
  speakerHookIntent: z.array(z.object({
    speakerId: z.string().uuid(),
    intent: hookIntentEnum,
  })),
  expressionStyle: conversationExpressionStyleEnum,
  fallbackMode: conversationFallbackModeEnum,
});
export type ConversationBrief = z.infer<typeof conversationBriefSchema>;

export const notificationRecordSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['conversation', 'consult', 'system']),
  linkedEventId: z.string().uuid(),
  threadId: z.string().uuid().optional(),
  participants: z.tuple([z.string().uuid(), z.string().uuid()]).optional(),
  snippet: z.string().optional(),
  occurredAt: z.string().datetime(),
  status: z.enum(['unread', 'read', 'archived']).default('unread'),
  priority: z.number().int().default(0),
  updated_at: z.string().datetime(),
});
export type NotificationRecord = z.infer<typeof notificationRecordSchema>;
