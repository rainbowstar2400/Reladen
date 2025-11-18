// apps/web/lib/gpt/call-gpt-for-conversation.ts
import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { gptConversationOutputSchema, type GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import { systemPromptConversation, buildUserPromptConversation } from "@repo/shared/gpt/prompts/conversation-prompt";
import { env } from "@/env";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const conversationResponseSchema = {
  name: "conversation_output",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      threadId: { type: "string" },
      participants: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 2,
      },
      topic: { type: "string" },
      lines: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            speaker: { type: "string" },
            text: { type: "string" },
          },
          required: ["speaker", "text"],
        },
      },
      meta: {
        type: "object",
        additionalProperties: false,
        properties: {
          tags: {
            type: "array",
            items: { type: "string" },
            maxItems: 12,
          },
          newKnowledge: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                target: { type: "string" },
                key: { type: "string" },
              },
              required: ["target", "key"],
            },
          },
          signals: {
            type: "array",
            items: { enum: ["continue", "close", "park"] },
          },
          qualityHints: {
            type: "object",
            additionalProperties: false,
            properties: {
              turnBalance: { enum: ["balanced", "skewed"] },
              tone: { type: "string" },
            },
          },
          debug: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["tags", "newKnowledge"],
      },
    },
    required: ["threadId", "participants", "topic", "lines", "meta"],
  },
  strict: true,
} as const;

type ResponseCreateParamsWithFormat =
  ResponseCreateParamsNonStreaming & {
    text?: {
      format?: {
        type: "json_schema";
        json_schema: typeof conversationResponseSchema;
      };
    };
  };

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

  try {
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
      text: {
        format: {
          type: "json_schema",
          json_schema: conversationResponseSchema,
        },
      },
    } as ResponseCreateParamsWithFormat);

    const content = extractTextFromResponse(res);
    if (!content) {
      throw new Error("GPT returned empty response.");
    }

    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch (error) {
      console.error("[callGptForConversation] JSON parse failed", { content });
      throw error;
    }
    const sanitized = sanitizeGptConversationOutput(raw, {
      threadId: params.thread.id,
      participants: params.thread.participants,
    });

    const parsed = gptConversationOutputSchema.safeParse(sanitized);
    if (!parsed.success) {
      console.error("GPT出力が不正です:", parsed.error);
      throw new Error("Invalid GPT output format.");
    }

    return parsed.data;
  } catch (error) {
    console.error("[callGptForConversation] Failed to create conversation", {
      name: (error as any)?.name,
      message: (error as any)?.message,
    });
    throw error;
  }
}

function sanitizeGptConversationOutput(
  raw: unknown,
  ctx: { threadId: string; participants: [string, string] },
) {
  const safeObject = isRecord(raw) ? { ...raw } : {};
  const participants = ctx.participants;
  const participantSet = new Set(participants);

  const topic = typeof safeObject.topic === "string" && safeObject.topic.trim().length > 0
    ? safeObject.topic.trim()
    : "雑談";

  const linesSource = Array.isArray((safeObject as any).lines) ? (safeObject as any).lines : [];
  const lines = linesSource
    .map((line: any, index: number) => {
      if (!isRecord(line)) return null;
      const text = typeof line.text === "string" ? line.text.trim() : "";
      if (!text) return null;
      const speakerRaw = typeof line.speaker === "string" ? line.speaker : undefined;
      const speaker = speakerRaw && participantSet.has(speakerRaw)
        ? speakerRaw
        : participants[index % participants.length];
      return { speaker, text };
    })
    .filter(
      (
        line: { speaker: string; text: string } | null,
      ): line is { speaker: string; text: string } => Boolean(line),
    );

  if (lines.length === 0) {
    lines.push({
      speaker: participants[0],
      text: `${participants[0]}と${participants[1]}の会話（自動補完）`,
    });
  }

  const metaInput = isRecord((safeObject as any).meta) ? (safeObject as any).meta : {};
  const tags = Array.isArray((metaInput as any).tags)
    ? (metaInput as any).tags
        .filter((tag: unknown): tag is string => typeof tag === "string" && tag.trim().length > 0)
        .slice(0, 12)
    : [];

  const newKnowledge = Array.isArray((metaInput as any).newKnowledge)
    ? (metaInput as any).newKnowledge
        .map((item: any) => {
          if (!isRecord(item)) return null;
          const target = typeof item.target === "string" && participantSet.has(item.target)
            ? item.target
            : null;
          const key = typeof item.key === "string" ? item.key.trim() : "";
          if (!target || !key) return null;
          return { target, key };
        })
        .filter(
          (
            item: { target: string; key: string } | null,
          ): item is { target: string; key: string } => Boolean(item),
        )
    : [];

  const signals = Array.isArray((metaInput as any).signals)
    ? (metaInput as any).signals.filter((signal: unknown): signal is "continue" | "close" | "park" =>
        signal === "continue" || signal === "close" || signal === "park",
      )
    : undefined;

  const qualityHints = isRecord((metaInput as any).qualityHints)
    ? {
        ...(metaInput.qualityHints?.turnBalance === "balanced" || metaInput.qualityHints?.turnBalance === "skewed"
          ? { turnBalance: metaInput.qualityHints.turnBalance }
          : {}),
        ...(typeof metaInput.qualityHints?.tone === "string" && metaInput.qualityHints.tone.trim().length > 0
          ? { tone: metaInput.qualityHints.tone.trim() }
          : {}),
      }
    : undefined;

  const debug = Array.isArray((metaInput as any).debug)
    ? (metaInput as any).debug.filter((item: unknown): item is string => typeof item === "string" && item.length > 0)
    : undefined;

  return {
    threadId: ctx.threadId,
    participants,
    topic,
    lines,
    meta: {
      tags,
      newKnowledge,
      ...(signals && signals.length > 0 ? { signals } : {}),
      ...(qualityHints && Object.keys(qualityHints).length > 0 ? { qualityHints } : {}),
      ...(debug && debug.length > 0 ? { debug } : {}),
    },
  } satisfies Partial<GptConversationOutput>;
}
