// packages/shared/gpt/schemas/conversation-output-v2.ts
// GPTのstructured output用JSON Schema（v2）

/**
 * OpenAI Responses API の text.format.schema に渡す JSON Schema 定義。
 * conversation-v2.ts の conversationOutputV2Schema と同等の構造を JSON Schema 形式で表現。
 */
export const conversationResponseSchemaV2 = {
  name: "conversation_output_v2",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      threadId: { type: "string" },
      participants: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 2,
      },
      topic: { type: "string" },
      lines: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            speaker: { type: "string" },
            text: { type: "string" },
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
                    about: { type: "string" },
                    fact: { type: "string" },
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
