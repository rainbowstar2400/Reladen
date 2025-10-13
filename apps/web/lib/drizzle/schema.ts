import { boolean, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deleted: boolean('deleted').notNull().default(false),
  ownerId: uuid('owner_id'),
});

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
