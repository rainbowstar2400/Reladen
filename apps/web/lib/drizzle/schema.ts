import { boolean, jsonb, pgEnum, pgTable, text, timestamp, integer, uuid, index } from 'drizzle-orm/pg-core';
import { relations as createRelations } from 'drizzle-orm';

// ... (relationTypeEnum, feelingLabelEnum は変更なし) ...
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

// ★ 1. presets テーブルを先に定義 (参照されるため)
/**
 * @description プリセットのカテゴリ
 */
export const presetCategoryEnum = pgEnum('preset_category', [
  'speech',
  'occupation',
  'first_person',
]);

/**
 * @description プリセット（話し方、職業、一人称）
 * `is_managed: true` = 管理ページで管理される
 * `is_managed: false` = フォームで手動入力された（管理ページには出ない）
 */
export const presets = pgTable('presets', {
  id: uuid('id').primaryKey().defaultRandom(), // ★ 唯一のキー
  category: presetCategoryEnum('category').notNull(), 
  
  // ★ 削除: 'value' カラム
  
  label: text('label').notNull(), // UIに表示されるラベル
  description: text('description'), // 話し方用のAI指示 (編集可能)
  
  // ★ 追加: 管理フラグ
  isManaged: boolean('is_managed').notNull().default(false),

  ownerId: uuid('owner_id'), 
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
}, (t) => ({
  categoryIdx: index('presets_category_idx').on(t.category),
  // ★ 変更: ラベルとカテゴリの組み合わせをユニークにする（例: 'speech' で 'ていねい' は1つだけ）
  uniqueLabel: { columns: [t.category, t.label, t.ownerId], isUnique: true },
}));


// ★ 2. residents テーブル
export const residents = pgTable('residents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  mbti: text('mbti'),
  traits: jsonb('traits'),
  
  // ★ 変更: presets.id を参照する uuid 型に変更
  speechPreset: uuid('speech_preset').references(() => presets.id, { onDelete: 'set null' }),
  
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
  ownerId: uuid('owner_id'),
});

// ★ 3. relations テーブル
export const relations = pgTable(
  'relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    aId: uuid('a_id').notNull(),
    bId: uuid('b_id').notNull(),
    type: relationTypeEnum('type').notNull().default('none'),

    gender: text('gender'),
    age: integer('age'),
    
    // ★ 変更: presets.id を参照する uuid 型に変更
    occupation: uuid('occupation').references(() => presets.id, { onDelete: 'set null' }),
    firstPerson: uuid('first_person').references(() => presets.id, { onDelete: 'set null' }),
    
    activityTendency: text('activity_tendency'),
    interests: jsonb('interests'),
    sleepProfile: jsonb('sleep_profile'),

    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deleted: boolean('deleted').notNull().default(false),
    ownerId: uuid('owner_id'),
  },
  (table) => ({
    uniquePair: { columns: [table.aId, table.bId], isUnique: true },
  })
);

// ... (feelings, events, residentsRelations, etc. は変更なし) ...
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