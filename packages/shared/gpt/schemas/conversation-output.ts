// packages/shared/gpt/schemas/conversation-output.ts
// GPT出力スキーマ（Zod + OpenAI JSON Schema）
import { z } from 'zod';
import { conversationFallbackModeEnum } from '@repo/shared/types/conversation';

// ---------------------------------------------------------------------------
// Zod スキーマ（persist-conversation が依存）
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// OpenAI Responses API 用 JSON Schema（structured output）
// ---------------------------------------------------------------------------

/**
 * OpenAI Responses API の text.format.schema に渡す JSON Schema 定義。
 * conversation-generation.ts の conversationOutputSchema と同等の構造を JSON Schema 形式で表現。
 */
export const conversationResponseSchema = {
  name: "conversation_output",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      threadId: { type: "string", format: "uuid" },
      participants: {
        type: "array",
        items: { type: "string", format: "uuid" },
        minItems: 2,
        maxItems: 2,
      },
      topic: { type: "string", minLength: 1 },
      lines: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            speaker: { type: "string", format: "uuid" },
            text: { type: "string", minLength: 1 },
          },
          required: ["speaker", "text"],
        },
      },
      meta: {
        type: "object",
        additionalProperties: false,
        properties: {
          tags: {
            type: "array",
            items: { type: "string" },
            maxItems: 12,
          },
          signals: {
            type: "array",
            items: { enum: ["continue", "close", "park"] },
          },
          qualityHints: {
            type: "object",
            additionalProperties: false,
            properties: {
              turnBalance: { enum: ["balanced", "skewed"] },
              tone: { type: "string" },
            },
            required: ["turnBalance", "tone"],
          },
          debug: {
            type: "array",
            items: { type: "string" },
          },
          memory: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: { type: "string", minLength: 1 },
              topicsCovered: {
                type: "array",
                items: { type: "string" },
              },
              unresolvedThreads: {
                type: "array",
                items: { type: "string" },
              },
              knowledgeGained: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    about: { type: "string", format: "uuid" },
                    fact: { type: "string", minLength: 1 },
                  },
                  required: ["about", "fact"],
                },
              },
            },
            required: ["summary", "topicsCovered", "unresolvedThreads", "knowledgeGained"],
          },
        },
        required: ["tags", "signals", "qualityHints", "debug", "memory"],
      },
    },
    required: ["threadId", "participants", "topic", "lines", "meta"],
  },
  strict: true,
} as const;
