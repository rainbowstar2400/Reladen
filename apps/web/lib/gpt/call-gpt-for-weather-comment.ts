import OpenAI from "openai";
import { env } from "@/env";
import type { WeatherCommentInput } from "@repo/shared/gpt/prompts/weather-comment";
import { buildWeatherCommentPrompt } from "@repo/shared/gpt/prompts/weather-comment";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

type ResponseMessageContent = {
  type: string;
  text?: unknown;
};

type ResponseMessageOutput = {
  type: "message";
  content: ResponseMessageContent[];
};

type ResponsesCreateReturn = Awaited<ReturnType<typeof client.responses.create>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isResponseMessageContentArray(value: unknown): value is ResponseMessageContent[] {
  return (
    Array.isArray(value) &&
    value.every((item) => isRecord(item) && typeof item.type === "string")
  );
}

function isResponseMessageOutput(item: unknown): item is ResponseMessageOutput {
  return isRecord(item) && item.type === "message" && isResponseMessageContentArray(item.content);
}

function extractTextFromResponse(res: ResponsesCreateReturn): string | null {
  if (typeof res.output_text === "string" && res.output_text.trim().length > 0) {
    return res.output_text.trim();
  }

  if (!Array.isArray((res as any).output)) return null;

  for (const item of (res as any).output) {
    if (!isResponseMessageOutput(item)) continue;
    const textChunks = item.content
      .filter((c) => c.type === "output_text" && typeof c.text === "string")
      .map((c) => (c.text as string).trim())
      .filter((c) => c.length > 0);
    if (textChunks.length > 0) return textChunks.join("\n");
  }

  return null;
}

export async function callGptForWeatherComment(input: WeatherCommentInput): Promise<string | null> {
  const { system, user } = buildWeatherCommentPrompt(input);
  try {
    const res = await client.responses.create({
      model: "gpt-5.1",
      temperature: 0.8,
      max_output_tokens: 120,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
    });

    const text = extractTextFromResponse(res);
    if (!text) return null;

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 2);

    return lines.length > 0 ? lines.join("\n") : null;
  } catch (error) {
    console.error("[callGptForWeatherComment] failed", error);
    return null;
  }
}
