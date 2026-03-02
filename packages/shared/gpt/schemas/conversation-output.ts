// packages/shared/gpt/schemas/conversation-output.ts
// GPT出力スキーマ（persist-conversationが依存）
// TODO: v2リネーム完了時に conversation-output-v2.ts と統合予定
import { z } from 'zod';
import { conversationFallbackModeEnum } from '@repo/shared/types/conversation';

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
  anchorExperienceId: z.string().uuid().optional(),
  anchorSignature: z.string().optional(),
  grounded: z.boolean().optional(),
  groundingEvidence: z.array(z.string()).optional(),
  fallbackMode: conversationFallbackModeEnum.optional(),
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
