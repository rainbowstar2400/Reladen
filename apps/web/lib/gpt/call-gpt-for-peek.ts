// apps/web/lib/gpt/call-gpt-for-peek.ts
// 覗く機能の GPT 呼び出し

import OpenAI from "openai";
import { env } from "@/env";
import { buildPeekPrompt, type PeekPromptInput } from "@repo/shared/gpt/prompts/peek-prompt";
import { peekOutputSchema, peekOutputJsonSchema, type PeekOutput } from "@repo/shared/gpt/schemas/peek-output";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const FALLBACK_PEEKS: PeekOutput[] = [
  { situation: "リビングのソファに座って、ぼんやり窓の外を眺めている。", monologue: "…今日は静かだな。" },
  { situation: "キッチンでコーヒーを淹れている。湯気がゆらゆら立ち上る。", monologue: "…もう一杯いこうかな。" },
  { situation: "机に向かって何かをノートに書き込んでいる。", monologue: "…あとでやろう。" },
  { situation: "本棚の前に立って、背表紙を指でなぞっている。", monologue: "…これ、途中だったっけ。" },
  { situation: "ベランダに出て、空を見上げている。", monologue: "…明日の天気、どうだろう。" },
];

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function callGptForPeek(input: PeekPromptInput): Promise<PeekOutput> {
  const { system, user } = buildPeekPrompt(input);

  try {
    const res = await client.responses.create({
      model: "gpt-5-mini",
      temperature: 0.9,
      max_output_tokens: 200,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
      text: {
        format: {
          type: "json_schema",
          ...peekOutputJsonSchema,
        },
      },
    });

    const raw = "output_text" in res && typeof res.output_text === "string"
      ? res.output_text.trim()
      : null;

    if (!raw) return pickRandom(FALLBACK_PEEKS);

    const parsed = peekOutputSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return pickRandom(FALLBACK_PEEKS);

    return parsed.data;
  } catch (error) {
    console.warn("[callGptForPeek] GPT call failed, using fallback.", error);
    return pickRandom(FALLBACK_PEEKS);
  }
}
