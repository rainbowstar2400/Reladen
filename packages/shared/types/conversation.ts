// packages/shared/types/conversation.ts
import { z } from 'zod';
import { baseEntitySchema, BaseEntity } from './base';

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
});

export const conversationEventPayloadSchema = z.object({
  threadId: z.string().uuid(),
  participants: z.tuple([z.string().uuid(), z.string().uuid()]),
  topic: z.string().optional(),
  lines: z.array(conversationLineSchema).min(1),
  meta: conversationMetaSchema,
  deltas: z.object({
    aToB: z.object({ favor: z.number(), impression: z.number() }),
    bToA: z.object({ favor: z.number(), impression: z.number() }),
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

// --- 会話スレッド・Belief・通知の型 ---

export const topicThreadSchema = baseEntitySchema.extend({
  topic: z.string().optional(),
  participants: z.tuple([z.string().uuid(), z.string().uuid()]),
  status: z.enum(['ongoing', 'paused', 'done']).default('ongoing'),
  lastEventId: z.string().uuid().optional(),
});
export type TopicThread = z.infer<typeof topicThreadSchema>;

export const beliefRecordSchema = z.object({
  id: z.string().uuid(),
  residentId: z.string().uuid(),
  worldFacts: z.array(z.object({
    eventId: z.string().uuid(),
    learnedAt: z.string().datetime(),
  })).default([]),
  personKnowledge: z.record(z.object({
    keys: z.array(z.string()),
    learnedAt: z.string().datetime(),
  })).default({}),
  updated_at: z.string().datetime(),
  deleted: z.boolean().default(false),
});
export type BeliefRecord = z.infer<typeof beliefRecordSchema>;

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
