// apps/web/lib/gpt/extract-speech-profile.ts
// 口調プリセットから SpeechProfile 構造化データを LLM で抽出する

import OpenAI from "openai";
import { z } from "zod";
import type { SpeechProfile } from "@repo/shared/types/conversation-generation";
import { env } from "@/env";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// JSON Schema（OpenAI structured output 用）
// ---------------------------------------------------------------------------

const speechProfileResponseSchema = {
  name: "speech_profile",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      endings: {
        type: "array" as const,
        description: "語尾パターン（例: 「〜だよ」「〜じゃん」「〜っす」）",
        items: { type: "string" as const },
      },
      frequentPhrases: {
        type: "array" as const,
        description: "よく使う口癖・表現（例: 「マジで」「てかさ」「なんつーか」）",
        items: { type: "string" as const },
      },
      avoidedPhrases: {
        type: "array" as const,
        description: "このキャラクターが使わない表現（例: 丁寧語キャラなら「マジ」「ヤバ」等）",
        items: { type: "string" as const },
      },
      examples: {
        type: "array" as const,
        description: "この口調での発話例（1〜3文）",
        items: { type: "string" as const },
      },
    },
    required: ["endings", "frequentPhrases", "avoidedPhrases", "examples"],
    additionalProperties: false,
  },
};

// ---------------------------------------------------------------------------
// Zod バリデーション
// ---------------------------------------------------------------------------

const extractedSchema = z.object({
  endings: z.array(z.string()).min(1),
  frequentPhrases: z.array(z.string()).default([]),
  avoidedPhrases: z.array(z.string()).default([]),
  examples: z.array(z.string()).min(1),
});

// ---------------------------------------------------------------------------
// 抽出関数
// ---------------------------------------------------------------------------

/**
 * 口調プリセットの label / description / example から
 * SpeechProfile の構造化データ（endings, frequentPhrases, avoidedPhrases, examples）を LLM で抽出する。
 */
export async function extractSpeechProfile(preset: {
  label: string;
  description: string;
  example?: string;
}): Promise<Omit<SpeechProfile, "label" | "description">> {
  const userPrompt = [
    `以下の口調設定から、語尾パターン・頻出表現・避ける表現・発話例を抽出してください。`,
    ``,
    `【口調名】${preset.label}`,
    `【説明】${preset.description}`,
    preset.example ? `【例文】${preset.example}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await client.responses.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "あなたは日本語の口調分析の専門家です。与えられた口調設定から、語尾パターン・頻出表現・避ける表現・発話例を構造化データとして抽出してください。",
          },
        ],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: userPrompt }],
      },
    ],
    text: {
      format: {
        name: speechProfileResponseSchema.name,
        type: "json_schema",
        schema: speechProfileResponseSchema.schema,
        strict: speechProfileResponseSchema.strict,
      },
    },
  } as any);

  // レスポンスからテキストを取得
  const content = extractTextFromResponse(res);
  if (!content) {
    throw new Error("[extractSpeechProfile] GPT returned empty response.");
  }

  const raw = JSON.parse(content);
  const parsed = extractedSchema.parse(raw);

  return {
    endings: parsed.endings,
    frequentPhrases: parsed.frequentPhrases,
    avoidedPhrases: parsed.avoidedPhrases,
    examples: parsed.examples,
  };
}

// ---------------------------------------------------------------------------
// レスポンス解析ヘルパー
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractTextFromResponse(res: unknown): string | null {
  if (!res) return null;
  const r = res as Record<string, unknown>;
  if (Array.isArray(r.output_text) && r.output_text.length > 0) {
    return (r.output_text as string[]).join("\n").trim();
  }
  if (!Array.isArray(r.output)) return null;
  for (const item of r.output as unknown[]) {
    if (!isRecord(item) || item.type !== "message") continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;
    const textChunks = (content as Array<Record<string, unknown>>)
      .filter((c) => c.type === "output_text" && typeof c.text === "string")
      .map((c) => (c.text as string).trim());
    if (textChunks.length > 0) return textChunks.join("\n");
  }
  return null;
}
