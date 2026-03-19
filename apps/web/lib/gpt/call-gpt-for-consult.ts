// apps/web/lib/gpt/call-gpt-for-consult.ts
// 相談システムの GPT 呼び出し（テーマ生成 + 返答生成）

import OpenAI from "openai";
import { env } from "@/env";
import {
  buildThemePrompt,
  buildReplyPrompt,
  type ThemePromptInput,
  type ReplyPromptInput,
} from "@repo/shared/gpt/prompts/consult-prompt";
import {
  consultThemeOutputSchema,
  consultThemeJsonSchema,
  consultReplyOutputSchema,
  consultReplyJsonSchema,
  type ConsultThemeOutput,
  type ConsultReplyOutput,
} from "@repo/shared/gpt/schemas/consult-output";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// テーマ生成
// ---------------------------------------------------------------------------

const FALLBACK_THEMES: ConsultThemeOutput[] = [
  {
    title: "ちょっと聞いてもらいたいこと",
    content: "最近ちょっと気になってることがあるんだけど…聞いてくれる？",
    choices: [
      { id: "c1", label: "もちろん、何でも言って" },
      { id: "c2", label: "うん、まあ聞くよ" },
      { id: "c3", label: "今はちょっと…" },
    ],
  },
];

export async function generateConsultTheme(
  input: ThemePromptInput,
): Promise<ConsultThemeOutput> {
  const { system, user } = buildThemePrompt(input);

  try {
    const res = await client.responses.create({
      model: "gpt-5-mini",
      temperature: 0.85,
      max_output_tokens: 400,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
      text: {
        format: {
          type: "json_schema",
          ...consultThemeJsonSchema,
        },
      },
    });

    const raw =
      "output_text" in res && typeof res.output_text === "string"
        ? res.output_text.trim()
        : null;

    if (!raw) return FALLBACK_THEMES[0];

    const parsed = consultThemeOutputSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return FALLBACK_THEMES[0];

    // choices が 3 件でない場合の補正
    if (parsed.data.choices.length !== 3) return FALLBACK_THEMES[0];

    return parsed.data;
  } catch (error) {
    console.warn("[generateConsultTheme] GPT call failed, using fallback.", error);
    return FALLBACK_THEMES[0];
  }
}

// ---------------------------------------------------------------------------
// 返答生成
// ---------------------------------------------------------------------------

const FALLBACK_REPLY: ConsultReplyOutput = {
  reply: "…そっか。ありがとう。",
  favorability: "neutral",
};

export async function generateConsultReply(
  input: ReplyPromptInput,
): Promise<ConsultReplyOutput> {
  const { system, user } = buildReplyPrompt(input);

  try {
    const res = await client.responses.create({
      model: "gpt-5-mini",
      temperature: 0.8,
      max_output_tokens: 200,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
      text: {
        format: {
          type: "json_schema",
          ...consultReplyJsonSchema,
        },
      },
    });

    const raw =
      "output_text" in res && typeof res.output_text === "string"
        ? res.output_text.trim()
        : null;

    if (!raw) return FALLBACK_REPLY;

    const parsed = consultReplyOutputSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return FALLBACK_REPLY;

    return parsed.data;
  } catch (error) {
    console.warn("[generateConsultReply] GPT call failed, using fallback.", error);
    return FALLBACK_REPLY;
  }
}
