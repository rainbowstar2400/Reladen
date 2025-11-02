// packages/shared/types/base.ts
import { z } from 'zod';

/** すべての永続エンティティに共通する最小集合（ID・更新・削除フラグ） */
export const baseEntitySchema = z.object({
  id: z.string().uuid(),
  updated_at: z.string().datetime(),
  deleted: z.boolean().default(false),
});

export type BaseEntity = z.infer<typeof baseEntitySchema>;
