// packages/shared/gpt/schemas/consult-output.ts
// 相談システムの GPT 出力スキーマ

import { z } from "zod";

// ---------------------------------------------------------------------------
// テーマ生成の出力
// ---------------------------------------------------------------------------

export const consultThemeOutputSchema = z.object({
  title: z.string().describe("相談タイトル（15-25文字）"),
  content: z.string().describe("相談本文（50-100文字、キャラの口調で）"),
  choices: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
      }),
    )
    .length(3)
    .describe("選択肢（3つ）"),
});

export type ConsultThemeOutput = z.infer<typeof consultThemeOutputSchema>;

/** OpenAI responses API 用の JSON Schema */
export const consultThemeJsonSchema = {
  name: "consult_theme",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      title: { type: "string" as const },
      content: { type: "string" as const },
      choices: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            id: { type: "string" as const },
            label: { type: "string" as const },
          },
          required: ["id", "label"],
          additionalProperties: false,
        },
      },
    },
    required: ["title", "content", "choices"],
    additionalProperties: false,
  },
};

// ---------------------------------------------------------------------------
// 返答生成の出力
// ---------------------------------------------------------------------------

export const consultReplyOutputSchema = z.object({
  reply: z.string().describe("返答テキスト（30-80文字、キャラの口調で）"),
  favorability: z.enum(["positive", "neutral", "negative"]).describe("プレイヤーの回答の好ましさ判定"),
});

export type ConsultReplyOutput = z.infer<typeof consultReplyOutputSchema>;

/** OpenAI responses API 用の JSON Schema */
export const consultReplyJsonSchema = {
  name: "consult_reply",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      reply: { type: "string" as const },
      favorability: {
        type: "string" as const,
        enum: ["positive", "neutral", "negative"],
      },
    },
    required: ["reply", "favorability"],
    additionalProperties: false,
  },
};
