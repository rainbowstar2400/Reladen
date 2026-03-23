// packages/shared/gpt/schemas/conversation-output.ts
// OpenAI Responses API 用 JSON Schema（structured output）
//
// 旧 Zod スキーマ (GptConversationOutput) は削除済み。
// Zod 型は conversation-generation.ts の ConversationOutput を使用すること。

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
              summary: { type: "string" },
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
        required: ["tags", "qualityHints", "debug", "memory"],
      },
    },
    required: ["threadId", "participants", "topic", "lines", "meta"],
  },
  strict: true,
} as const;
