// packages/shared/gpt/schemas/conversation-output.ts
import { z } from 'zod';

// 会話行（GPTの出力）
export const gptConversationLineSchema = z.object({
  speaker: z.string().uuid(),
  text: z.string().min(1),
});

// メタ情報
export const gptConversationMetaSchema = z.object({
  tags: z.array(z.string()).max(12),
  newKnowledge: z.array(z.object({
    target: z.string().uuid(),
    key: z.string().min(1),
  })),
  signals: z.array(z.enum(['continue', 'close', 'park'])),
  qualityHints: z.object({
    turnBalance: z.enum(['balanced', 'skewed']),
    tone: z.string(),
  }),
  debug: z.array(z.string()),
});

// GPT出力本体
export const gptConversationOutputSchema = z.object({
  threadId: z.string().uuid(),
  participants: z.tuple([z.string().uuid(), z.string().uuid()]),
  topic: z.string().min(1),
  lines: z.array(gptConversationLineSchema).min(1),
  meta: gptConversationMetaSchema,
});

// 型エクスポート
export type GptConversationOutput = z.infer<typeof gptConversationOutputSchema>;
