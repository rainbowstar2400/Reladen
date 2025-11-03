// apps/web/lib/schemas/server/conversation.ts
import { z } from 'zod';

/** サーバアクション入力：会話の種（トピックなど） */
export const StartConversationInput = z.object({
  threadId: z.string().min(1),
  participants: z.tuple([z.string().min(1), z.string().min(1)]),
  topic: z.string().optional(),
  // 将来的に「背景情報」「現在の関係」「制約」などを拡張
  hints: z.object({
    tone: z.enum(['casual','polite','serious']).optional(),
    maxLines: z.number().int().min(2).max(16).default(6),
  }).default({}),
  idempotencyKey: z.string().uuid().optional(), // 二重送信対策（任意）
});

export type TStartConversationInput = z.infer<typeof StartConversationInput>;
