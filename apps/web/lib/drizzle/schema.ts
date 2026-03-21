import { boolean, jsonb, pgEnum, pgTable, text, timestamp, integer, uuid, index } from 'drizzle-orm/pg-core';
import { relations as createRelations } from 'drizzle-orm';

export const nicknameTendencyEnum = pgEnum('nickname_tendency_enum', ['nickname', 'bare', 'san', 'kun_chan', 'hierarchy']);

export const relationTypeEnum = pgEnum('relation_type', ['none', 'acquaintance', 'friend', 'best_friend', 'lover', 'family']);
export const feelingLabelEnum = pgEnum('feeling_label', [
  'none',
  'dislike',
  'maybe_dislike',
  'curious',
  'maybe_like',
  'like',
  'love',
  'awkward',
]);
export const feelingBaseLabelEnum = pgEnum('feeling_base_label', [
  'dislike',
  'maybe_dislike',
  'none',
  'curious',
  'maybe_like',
  'like',
  'love',
]);
export const feelingSpecialLabelEnum = pgEnum('feeling_special_label', ['awkward']);

export const presetCategoryEnum = pgEnum('preset_category', [
  'speech',
  'occupation',
  'first_person',
]);

export const presets = pgTable('presets', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: presetCategoryEnum('category').notNull(),
  label: text('label').notNull(),
  description: text('description'),
  example: text('example'),
  speechProfileData: jsonb('speech_profile_data'),
  isManaged: boolean('is_managed').notNull().default(false),
  ownerId: uuid('owner_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
}, (t) => ({
  categoryIdx: index('presets_category_idx').on(t.category),
  uniqueLabel: { columns: [t.category, t.label, t.ownerId], isUnique: true },
}));


// 2. residents テーブル
export const residents = pgTable('residents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  mbti: text('mbti'),
  traits: jsonb('traits'),
  trustToPlayer: integer('trust_to_player').notNull().default(50),
  speechPreset: uuid('speech_preset').references(() => presets.id, { onDelete: 'set null' }),
  gender: text('gender'),
  age: integer('age'),
  birthday: text('birthday'), // "MM/DD" 形式で保存
  occupation: uuid('occupation').references(() => presets.id, { onDelete: 'set null' }),
  firstPerson: uuid('first_person').references(() => presets.id, { onDelete: 'set null' }),
  interests: jsonb('interests'),
  sleepProfile: jsonb('sleep_profile'),
  nicknameTendency: nicknameTendencyEnum('nickname_tendency').default('san'),

  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
  ownerId: uuid('owner_id'),
});

// relations テーブル
export const relations = pgTable(
  'relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    aId: uuid('a_id').notNull(), // 参照元 (将来的に residents.id を参照)
    bId: uuid('b_id').notNull(), // 参照先 (将来的に residents.id を参照)
    type: relationTypeEnum('type').notNull().default('none'), // 関係性
    familySubType: text('family_sub_type'), // F-3: 家族種別（兄/姉/父/母等）。type='family'時のみ使用
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deleted: boolean('deleted').notNull().default(false),
    ownerId: uuid('owner_id'),
  },
  (table) => ({
    uniquePair: { columns: [table.aId, table.bId], isUnique: true },
  })
);

export const feelings = pgTable(
  'feelings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromId: uuid('from_id').notNull(),
    toId: uuid('to_id').notNull(),
    label: feelingLabelEnum('label').notNull().default('none'),
    // 印象の3層表現（base / special / baseBeforeSpecial）
    baseLabel: feelingBaseLabelEnum('base_label').notNull().default('none'),
    specialLabel: feelingSpecialLabelEnum('special_label'),
    baseBeforeSpecial: feelingBaseLabelEnum('base_before_special'),

    // 好感度スコア
    score: integer('score').notNull().default(30),

    // 印象判定用: 直近3件のfavorデルタ窓 (newest-first)
    recentDeltas: jsonb('recent_deltas').notNull().default([]),

    // 最終接触日時（時間経過バッチ用）
    lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),

    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deleted: boolean('deleted').notNull().default(false),
    ownerId: uuid('owner_id'),
  },
  (table) => ({
    uniqueDirectional: { columns: [table.fromId, table.toId], isUnique: true },
  })
);

// nicknames テーブル
export const nicknames = pgTable(
  'nicknames',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromId: uuid('from_id').notNull(), // 呼ぶ側
    toId: uuid('to_id').notNull(),   // 呼ばれる側
    nickname: text('nickname').notNull(), // 呼び名
    locked: boolean('locked').notNull().default(false), // D-3: 手動設定ロック
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deleted: boolean('deleted').notNull().default(false),
    ownerId: uuid('owner_id'),
  },
  (table) => ({
    // fromId と toId のペアでユニーク制約を設ける
    uniqueDirectionalNickname: { columns: [table.fromId, table.toId], isUnique: true },
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
  nicknamesFrom: many(nicknames, { relationName: 'nicknames_from' }),
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
    relationName: 'feelings_from', // relationName を明記
  }),
  toResident: one(residents, {
    fields: [feelings.toId],
    references: [residents.id],
    // relationName: 'feelings_to' // 相手側は 'feelingsTo' として参照
  }),
}));

export const nicknamesRelations = createRelations(nicknames, ({ one }) => ({
  fromResident: one(residents, {
    fields: [nicknames.fromId],
    references: [residents.id],
    relationName: 'nicknames_from', // relationName を明記
  }),
  toResident: one(residents, {
    fields: [nicknames.toId],
    references: [residents.id],
    // relationName: 'nicknames_to'
  }),
}));

export const topicThreads = pgTable('topic_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  topic: text('topic'),
  participants: jsonb('participants').notNull(), // [aId, bId]
  status: text('status').notNull().default('ongoing'), // 'ongoing' | 'done'
  lastEventId: uuid('last_event_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  deleted: boolean('deleted').notNull().default(false),
  ownerId: uuid('owner_id'),
}, (t) => ({
  statusIdx: index('topic_threads_status_idx').on(t.status),
  updatedIdx: index('topic_threads_updated_idx').on(t.updatedAt),
}));

// E-4: consult_answers テーブル（相談回答の永続化）
export const consultAnswers = pgTable('consult_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id'),
  selectedChoiceId: text('selected_choice_id'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
  ownerId: uuid('owner_id'),
});

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
  ownerId: uuid('owner_id'),
}, (t) => ({
  statusIdx: index('notifications_status_idx').on(t.status),
  occurredIdx: index('notifications_occurred_idx').on(t.occurredAt),
  updatedIdx: index('notifications_updated_idx').on(t.updatedAt),
}));

export const sharedSnippets = pgTable('shared_snippets', {
  id: uuid('id').primaryKey().defaultRandom(),
  participantA: uuid('participant_a').notNull(),
  participantB: uuid('participant_b').notNull(),
  text: text('text').notNull(),
  source: text('source').notNull().default('coincidence'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
  ownerId: uuid('owner_id'),
});

export const recentEvents = pgTable('recent_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterId: uuid('character_id').notNull(),
  fact: text('fact').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  sharedWith: jsonb('shared_with').notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
  ownerId: uuid('owner_id'),
});

export const offscreenKnowledge = pgTable('offscreen_knowledge', {
  id: uuid('id').primaryKey().defaultRandom(),
  learnedBy: uuid('learned_by').notNull(),
  about: uuid('about').notNull(),
  fact: text('fact').notNull(),
  source: text('source').notNull().default('offscreen'),
  learnedAt: timestamp('learned_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
  ownerId: uuid('owner_id'),
});

export const worldStates = pgTable('world_states', {
  id: uuid('id').primaryKey().defaultRandom(),
  weatherCurrent: jsonb('weather_current').notNull(),
  weatherQuietHours: jsonb('weather_quiet_hours').notNull(),
  weatherComment: jsonb('weather_comment'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
  ownerId: uuid('owner_id'),
}, (t) => ({
  updatedIdx: index('world_states_updated_idx').on(t.updatedAt),
}));


