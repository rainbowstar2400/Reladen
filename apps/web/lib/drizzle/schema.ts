import { boolean, jsonb, pgEnum, pgTable, text, timestamp, integer, uuid, index } from 'drizzle-orm/pg-core';
import { relations as createRelations } from 'drizzle-orm';

export const relationTypeEnum = pgEnum('relation_type', ['none', 'friend', 'best_friend', 'lover', 'family']);
export const feelingLabelEnum = pgEnum('feeling_label', [
  'none',
  'dislike',
  'curious',
  'maybe_like',
  'like',
  'love',
  'awkward',
]);

export const residents = pgTable('residents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  mbti: text('mbti'),
  traits: jsonb('traits'),
  speechPreset: text('speech_preset'), // ★ 追加 (話し方プリセット)
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
  ownerId: uuid('owner_id'),
});

export const relations = pgTable(
  'relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    aId: uuid('a_id').notNull(),
    bId: uuid('b_id').notNull(),
    type: relationTypeEnum('type').notNull().default('none'),

    gender: text('gender'),                 // 'male' | 'female' | 'nonbinary' | 'other'
    age: integer('age'),                    // 0..120 想定
    occupation: text('occupation'),         // 列挙相当だが text で保存
    firstPerson: text('first_person'),      // '私'など
    activityTendency: text('activity_tendency'), // 'morning'|'normal'|'night'
    interests: jsonb('interests'),          // string[] を想定
    sleepProfile: jsonb('sleep_profile'),   // { bedtime, wakeTime, prepMinutes }

    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deleted: boolean('deleted').notNull().default(false),
    ownerId: uuid('owner_id'),
  },
  (table) => ({
    uniquePair: { columns: [table.aId, table.bId], isUnique: true },
  })
);

// ... (feelings, events テーブルは変更なし) ...
export const feelings = pgTable(
  'feelings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromId: uuid('from_id').notNull(),
    toId: uuid('to_id').notNull(),
    label: feelingLabelEnum('label').notNull().default('none'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deleted: boolean('deleted').notNull().default(false),
    ownerId: uuid('owner_id'),
  },
  (table) => ({
    uniqueDirectional: { columns: [table.fromId, table.toId], isUnique: true },
  })
);

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull(),
  payload: jsonb('payload').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  deleted: boolean('deleted').notNull().default(false),
  ownerId: uuid('owner_id'),
}, (t) => ({
  byKind: index('events_kind_idx').on(t.kind),
  byUpdated: index('events_updated_idx').on(t.updatedAt),
}));

// ... (residentsRelations, relationsResidents, feelingsRelations, topicThreads, beliefs, notifications テーブルは変更なし) ...
export const residentsRelations = createRelations(residents, ({ many }) => ({
  relations: many(relations),
  feelingsFrom: many(feelings, { relationName: 'feelings_from' }),
}));

export const relationsResidents = createRelations(relations, ({ one }) => ({
  residentA: one(residents, {
    fields: [relations.aId],
    references: [residents.id],
  }),
  residentB: one(residents, {
    fields: [relations.bId],
    references: [residents.id],
  }),
}));

export const feelingsRelations = createRelations(feelings, ({ one }) => ({
  fromResident: one(residents, {
    fields: [feelings.fromId],
    references: [residents.id],
  }),
  toResident: one(residents, {
    fields: [feelings.toId],
    references: [residents.id],
  }),
}));

export const topicThreads = pgTable('topic_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  topic: text('topic'),
  participants: jsonb('participants').notNull(), // [aId, bId]
  status: text('status').notNull().default('ongoing'), // 'ongoing' | 'paused' | 'done'
  lastEventId: uuid('last_event_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  deleted: boolean('deleted').notNull().default(false),
}, (t) => ({
  statusIdx: index('topic_threads_status_idx').on(t.status),
  updatedIdx: index('topic_threads_updated_idx').on(t.updatedAt),
}));

export const beliefs = pgTable('beliefs', {
  id: uuid('id').primaryKey().defaultRandom(),
  residentId: uuid('resident_id').notNull(),
  worldFacts: jsonb('world_facts').notNull().default([]),      // Array<{ eventId, learnedAt }>
  personKnowledge: jsonb('person_knowledge').notNull().default({}), // Record<targetId, { keys[], learnedAt }>
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  deleted: boolean('deleted').notNull().default(false),
}, (t) => ({
  residentIdx: index('beliefs_resident_idx').on(t.residentId),
  updatedIdx: index('beliefs_updated_idx').on(t.updatedAt),
}));

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // 'conversation' | 'consult' | 'system'
  linkedEventId: uuid('linked_event_id').notNull(),
  threadId: uuid('thread_id'),
  participants: jsonb('participants'),
  snippet: text('snippet'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('unread'), // 'unread' | 'read' | 'archived'
  priority: integer('priority').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, (t) => ({
  statusIdx: index('notifications_status_idx').on(t.status),
  occurredIdx: index('notifications_occurred_idx').on(t.occurredAt),
  updatedIdx: index('notifications_updated_idx').on(t.updatedAt),
}));

/**
 * @description プリセットのカテゴリ
 * - speech: 話し方
 * - occupation: 職業
 * - first_person: 一人称
 */
export const presetCategoryEnum = pgEnum('preset_category', [
  'speech',
  'occupation',
  'first_person',
]);

/**
 * @description ユーザーが管理するプリセット
 */
export const presets = pgTable('presets', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: presetCategoryEnum('category').notNull(), // 'speech' | 'occupation' | 'first_person'
  value: text('value').notNull(), // DBに保存される値 (e.g., 'polite', 'student', '私')
  label: text('label').notNull(), // UIに表示されるラベル (e.g., 'ていねい', '学生', '私')
  ownerId: uuid('owner_id'), // 将来的にユーザーごとに管理する場合
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
}, (t) => ({
  categoryIdx: index('presets_category_idx').on(t.category),
  // value はカテゴリ内でユニーク（ownerId が null の場合はグローバルでユニーク）
  uniquePreset: { columns: [t.category, t.value, t.ownerId], isUnique: true },
}));