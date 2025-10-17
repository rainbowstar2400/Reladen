import { z } from 'zod';

export const baseEntitySchema = z.object({
  id: z.string().uuid(),
  updated_at: z.string().datetime(),
  deleted: z.boolean().default(false),
  owner_id: z.string().uuid().nullable().optional(),
});

export const residentSchema = baseEntitySchema.extend({
  name: z.string().min(1),
  mbti: z.string().nullable().optional(),
  traits: z.record(z.any()).nullable().optional(),
});

export const relationSchema = baseEntitySchema.extend({
  a_id: z.string().uuid(),
  b_id: z.string().uuid(),
  type: z.enum(['none', 'friend', 'best_friend', 'lover', 'family']),
});

export const feelingSchema = baseEntitySchema.extend({
  from_id: z.string().uuid(),
  to_id: z.string().uuid(),
  label: z.enum(['none', 'dislike', 'curious', 'maybe_like', 'like', 'love', 'awkward']),
});

export const eventSchema = baseEntitySchema.extend({
  kind: z.string(),
  payload: z.record(z.any()),
});

export const syncPayloadSchema = z.object({
  table: z.enum(['residents', 'relations', 'feelings', 'events']),
  changes: z.array(z.object({
    data: z.record(z.any()),
    updated_at: z.string().datetime(),
    deleted: z.boolean().optional(),
  })),
  since: z.string().datetime().optional(),
});

export type Resident = z.infer<typeof residentSchema>;
export type Relation = z.infer<typeof relationSchema>;
export type Feeling = z.infer<typeof feelingSchema>;
export type EventLog = z.infer<typeof eventSchema>;
export type SyncPayload = z.infer<typeof syncPayloadSchema>;
