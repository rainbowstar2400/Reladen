// apps/web/lib/gpt/call-gpt-for-conversation.ts
import OpenAI from "openai";
import { gptConversationOutputSchema, type GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import { systemPromptConversation, buildUserPromptConversation } from "@repo/shared/gpt/prompts/conversation-prompt";
import { env } from "@/env";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

function extractTextFromResponse(res: Awaited<ReturnType<typeof client.responses.create>>): string | null {
  if (Array.isArray(res.output_text) && res.output_text.length > 0) {
    return res.output_text.join("\n").trim();
  }

  if (!Array.isArray(res.output)) return null;
  for (const item of res.output) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    const textChunks = item.content
      .filter((c) => c.type === "output_text" && typeof c.text === "string")
      .map((c) => c.text.trim());
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
    response_format: { type: "json_object" },
    input: [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: systemPrompt,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "text",
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