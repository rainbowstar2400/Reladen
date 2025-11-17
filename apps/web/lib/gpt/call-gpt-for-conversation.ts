// apps/web/lib/gpt/call-gpt-for-conversation.ts
import OpenAI from "openai";
import { gptConversationOutputSchema, type GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import { systemPromptConversation, buildUserPromptConversation } from "@repo/shared/gpt/prompts/conversation-prompt";
import { env } from "@/env";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

type ResponsesCreateReturn = Awaited<ReturnType<typeof client.responses.create>>;

type ResponseMessageContent = {
  type: string;
  text?: unknown;
};

type ResponseMessageOutput = {
  type: "message";
  content: ResponseMessageContent[];
};

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

function hasOutputText(res: ResponsesCreateReturn): res is ResponsesCreateReturn & { output_text: string[] } {
  return "output_text" in res;
}

function hasOutput(res: ResponsesCreateReturn): res is ResponsesCreateReturn & { output: unknown } {
  return "output" in res;
}

function extractTextFromResponse(res: ResponsesCreateReturn): string | null {
  if (hasOutputText(res) && Array.isArray(res.output_text) && res.output_text.length > 0) {
    return res.output_text.join("\n").trim();
  }

  if (!hasOutput(res) || !Array.isArray(res.output)) return null;
  for (const item of res.output) {
    if (!isResponseMessageOutput(item)) continue;
    const textChunks = item.content
      .filter((c) => c.type === "output_text" && typeof c.text === "string")
      .map((c) => (c.text as string).trim());
    if (textChunks.length > 0) return textChunks.join("\n");
  }
  return null;
}

export async function callGptForConversation(
  params: Parameters<typeof buildUserPromptConversation>[0],
): Promise<GptConversationOutput> {
  const systemPrompt = systemPromptConversation;
  const userPrompt = buildUserPromptConversation(params);

  const res = await client.responses.create({
    model: "gpt-5-chat-latest",
    temperature: 0.8,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: systemPrompt,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: userPrompt,
          },
        ],
      },
    ],
  });

  const content = extractTextFromResponse(res);
  if (!content) {
    throw new Error("GPT returned empty response.");
  }

  const parsed = gptConversationOutputSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    console.error("GPT出力が不正です:", parsed.error);
    throw new Error("Invalid GPT output format.");
  }

  return parsed.data;
}