import OpenAI from "openai";
import { env } from "@/env";
import type { WeatherCommentInput } from "@repo/shared/gpt/prompts/weather-comment";
import { buildWeatherCommentPrompt } from "@repo/shared/gpt/prompts/weather-comment";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function callGptForWeatherComment(input: WeatherCommentInput): Promise<string | null> {
  const { system, user } = buildWeatherCommentPrompt(input);
  try {
    const res = await client.responses.create({
      model: "gpt-5.2-chat-latest",
      temperature: 0.7,
      max_output_tokens: 120,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
    });

    const text = (res.output_text ?? [])[0] ?? null;
    if (typeof text === "string") {
      const trimmed = text.trim();
      return trimmed ? trimmed : null;
    }
    return null;
  } catch (error) {
    console.error("[callGptForWeatherComment] failed", error);
    return null;
  }
}
