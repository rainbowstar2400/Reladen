// packages/shared/gpt/schemas/peek-output.ts
// 覗く機能の GPT 出力スキーマ

import { z } from "zod";

export const peekOutputSchema = z.object({
  situation: z.string().describe("状況描写（30-50文字）"),
  monologue: z.string().describe("独り言（20-40文字）"),
});

export type PeekOutput = z.infer<typeof peekOutputSchema>;

/** OpenAI responses API 用の JSON Schema */
export const peekOutputJsonSchema = {
  name: "peek_output",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      situation: { type: "string" as const },
      monologue: { type: "string" as const },
    },
    required: ["situation", "monologue"],
    additionalProperties: false,
  },
};
