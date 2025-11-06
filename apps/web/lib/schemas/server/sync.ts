// apps/web/lib/schemas/server/sync.ts
import { z } from 'zod';

export const allowedTables = ['residents','relations','feelings','events','consult_answers'] as const;
export type AllowedTable = typeof allowedTables[number];

const isoDate = z.string().refine(
  (s) => !s || !Number.isNaN(Date.parse(s)),
  { message: 'invalid ISO datetime' }
);

export const syncChangeSchema = z.object({
  data: z.record(z.any()).and(
    z.object({
      updated_at: z.string(),          // ISO（LWWに使用）
      deleted: z.boolean().optional(), // tombstone運用
      id: z.string().uuid().optional() // あるなら検証
    })
  ),
  updated_at: z.string(),              // 冗長でもクライアント整合のため受容
  deleted: z.boolean().optional(),
});

export const syncRequestSchema = z.object({
  table: z.enum(allowedTables),
  since: isoDate.optional(),
  changes: z.array(syncChangeSchema).default([]),
});

export type TSyncRequest = z.infer<typeof syncRequestSchema>;

export const syncResponseSchema = z.object({
  table: z.enum(allowedTables),
  changes: z.array(syncChangeSchema),
});
export type TSyncResponse = z.infer<typeof syncResponseSchema>;
