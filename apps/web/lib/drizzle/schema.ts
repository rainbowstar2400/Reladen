import { boolean, jsonb, pgEnum, pgTable, text, timestamp, integer, uuid, index } from 'drizzle-orm/pg-core';
import { relations as createRelations } from 'drizzle-orm';

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
export const experienceSourceTypeEnum = pgEnum('experience_source_type', [
  'lifestyle',
  'work',
  'interpersonal',
  'environment',
]);
export const experienceAwarenessEnum = pgEnum('experience_awareness', [
  'direct',
  'witnessed',
  'heard',
]);
export const hookIntentEnum = pgEnum('hook_intent', [
  'invite',
  'share',
  'complain',
  'consult',
  'reflect',
]);

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

    // 好感度スコア
    score: integer('score').notNull().default(0),

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
  status: text('status').notNull().default('ongoing'), // 'ongoing' | 'paused' | 'done'
  lastEventId: uuid('last_event_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  deleted: boolean('deleted').notNull().default(false),
  ownerId: uuid('owner_id'),
}, (t) => ({
  statusIdx: index('topic_threads_status_idx').on(t.status),
  updatedIdx: index('topic_threads_updated_idx').on(t.updatedAt),
}));

export const experienceEvents = pgTable('experience_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id'),
  sourceType: experienceSourceTypeEnum('source_type').notNull(),
  sourceRef: text('source_ref'),
  factSummary: text('fact_summary').notNull(),
  factDetail: jsonb('fact_detail'),
  tags: jsonb('tags').notNull().default([]),
  significance: integer('significance').notNull().default(0),
  signature: text('signature').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
}, (t) => ({
  byOwnerOccurredAt: index('experience_events_owner_occurred_idx').on(t.ownerId, t.occurredAt),
  byOwnerSignatureOccurredAt: index('experience_events_owner_signature_occurred_idx').on(t.ownerId, t.signature, t.occurredAt),
}));

export const residentExperiences = pgTable('resident_experiences', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id'),
  experienceId: uuid('experience_id').notNull().references(() => experienceEvents.id, { onDelete: 'cascade' }),
  residentId: uuid('resident_id').notNull(),
  awareness: experienceAwarenessEnum('awareness').notNull(),
  appraisal: text('appraisal').notNull(),
  hookIntent: hookIntentEnum('hook_intent').notNull(),
  confidence: integer('confidence').notNull().default(0),
  salience: integer('salience').notNull().default(0),
  learnedAt: timestamp('learned_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
}, (t) => ({
  byOwnerResidentSalienceLearnedAt: index('resident_experiences_owner_resident_salience_learned_idx').on(t.ownerId, t.residentId, t.salience, t.learnedAt),
  byOwnerExperienceResident: index('resident_experiences_owner_experience_resident_idx').on(t.ownerId, t.experienceId, t.residentId),
  uniqueOwnerExperienceResident: { columns: [t.ownerId, t.experienceId, t.residentId], isUnique: true },
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


