// apps/web/lib/gpt/call-gpt-for-conversation.ts
import OpenAI from "openai";
import { gptConversationOutputSchema, GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import { systemPromptConversation, buildUserPromptConversation } from "@repo/shared/gpt/prompts/conversation-prompt";

const apiKey =
  process.env.OPENAI_API_KEY ?? process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? "";
if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not set.");
}
const client = new OpenAI({ apiKey });

export async function callGptForConversation(
  params: Parameters<typeof buildUserPromptConversation>[0]
): Promise<GptConversationOutput> {
  const systemPrompt = systemPromptConversation;
  const userPrompt = buildUserPromptConversation(params);

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("GPT returned empty response.");

  const parsed = gptConversationOutputSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    console.error("GPT出力が不正です:", parsed.error);
    throw new Error("Invalid GPT output format.");
  }

  return parsed.data;
}
