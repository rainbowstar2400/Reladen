// packages/shared/types/conversation.ts
// 会話イベント・スレッド・通知など、アプリ共通の型定義。
// 会話生成パイプライン固有の型は conversation-generation.ts を参照。
import { z } from 'zod';
import { baseEntitySchema } from './base';
import { conversationMemorySchema } from './conversation-generation';

// 印象（base）と special（気まずさ等）の分離
export const impressionBaseEnum = z.enum(['dislike', 'maybe_dislike', 'none', 'curious', 'maybe_like', 'like', 'love']);
export type ImpressionBase = z.infer<typeof impressionBaseEnum>;

export const impressionSpecialEnum = z.enum(['awkward']);
export type ImpressionSpecial = z.infer<typeof impressionSpecialEnum>;

export const impressionStateSchema = z.object({
  base: impressionBaseEnum,
  special: impressionSpecialEnum.nullable().optional(),
  baseBeforeSpecial: impressionBaseEnum.nullable().optional(),
});
export type ImpressionState = z.infer<typeof impressionStateSchema>;

export const conversationLineSchema = z.object({
  speaker: z.string().uuid(),
  text: z.string().min(1),
});

const eventMetaSchema = z.object({
  tags: z.array(z.string()).max(12),
  qualityHints: z.object({
    turnBalance: z.enum(['balanced', 'skewed']).optional(),
    tone: z.string().optional(),
  }).optional(),
  debug: z.array(z.string()).optional(),
  memory: conversationMemorySchema.optional(), // optional: 旧データには存在しない
});

export const conversationEventPayloadSchema = z.object({
  threadId: z.string().uuid(),
  participants: z.tuple([z.string().uuid(), z.string().uuid()]),
  topic: z.string().optional(),
  situation: z.string().optional(),
  lines: z.array(conversationLineSchema).min(1),
  meta: eventMetaSchema,
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

export const relationTriggerEventPayloadSchema = z.object({
  trigger: z.enum(['confession', 'breakup']),
  residentId: z.string().uuid(),
  targetId: z.string().uuid(),
  participants: z.tuple([z.string().uuid(), z.string().uuid()]).optional(),
  currentRelation: z.string().optional(),
  handled: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (value.residentId === value.targetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'residentId and targetId must be different',
      path: ['targetId'],
    });
  }

  if (value.participants) {
    if (value.participants[0] !== value.residentId || value.participants[1] !== value.targetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'participants must be [residentId, targetId]',
        path: ['participants'],
      });
    }
  }
});
export type RelationTriggerEventPayload = z.infer<typeof relationTriggerEventPayloadSchema>;

export const eventKindEnum = z.enum([
  'conversation', 'favor_change', 'feeling_change', 'system', 'consult', 'relation_trigger',
]);

export const eventSchemaStrict = baseEntitySchema.and(
  z.object({
    kind: eventKindEnum,
    owner_id: z.string().uuid().nullable().optional(),
    payload: z.union([
      conversationEventPayloadSchema,
      favorChangeEventPayloadSchema,
      feelingChangeEventPayloadSchema,
      relationTriggerEventPayloadSchema,
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
  status: z.enum(['ongoing', 'done']).default('ongoing'),
  lastEventId: z.string().uuid().optional(),
});
export type TopicThread = z.infer<typeof topicThreadSchema>;

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
