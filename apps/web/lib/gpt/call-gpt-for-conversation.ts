// apps/web/lib/gpt/call-gpt-for-conversation.ts
// 会話生成 GPT呼び出し + 検証 + リトライ

import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { conversationOutputSchema, type ConversationOutput } from "@repo/shared/types/conversation-generation";
import { conversationResponseSchema } from "@repo/shared/gpt/schemas/conversation-output";
import {
  systemPromptConversation,
  buildUserPrompt,
  type PromptInput,
} from "@repo/shared/gpt/prompts/conversation-prompt";
import {
  validateConversationOutput,
  buildRetryFeedback,
  type ValidationInput,
} from "@repo/shared/logic/conversation-validator";
import type { ConversationStructure } from "@repo/shared/types/conversation-generation";
import { env } from "@/env";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const MAX_RETRY_COUNT = 1;

// ---------------------------------------------------------------------------
// Response 型ヘルパー
// ---------------------------------------------------------------------------

type ResponsesCreateReturn = Awaited<ReturnType<typeof client.responses.create>>;

type ResponseMessageContent = {
  type: string;
  text?: unknown;
};

type ResponseMessageOutput = {
  type: "message";
  content: ResponseMessageContent[];
};

type ResponseCreateParamsWithFormat =
  ResponseCreateParamsNonStreaming & {
    text?: {
      format?: {
        name: string;
        type: "json_schema";
        schema: typeof conversationResponseSchema.schema;
        strict?: boolean;
      };
    };
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

function extractTextFromResponse(res: unknown): string | null {
  if (!res) return null;
  const r = res as Record<string, unknown>;
  if (Array.isArray(r.output_text) && r.output_text.length > 0) {
    return (r.output_text as string[]).join("\n").trim();
  }
  if (!Array.isArray(r.output)) return null;
  for (const item of r.output as unknown[]) {
    if (!isResponseMessageOutput(item)) continue;
    const textChunks = item.content
      .filter((c) => c.type === "output_text" && typeof c.text === "string")
      .map((c) => (c.text as string).trim());
    if (textChunks.length > 0) return textChunks.join("\n");
  }
  return null;
}

// ---------------------------------------------------------------------------
// サニタイズ（GPT出力を正規化）
// ---------------------------------------------------------------------------

function sanitizeOutput(
  raw: unknown,
  ctx: { threadId: string; participants: [string, string] },
): Record<string, unknown> {
  const obj = isRecord(raw) ? { ...raw } : {};
  const participantSet = new Set(ctx.participants);

  // threadId / participants を強制
  obj.threadId = ctx.threadId;
  obj.participants = ctx.participants;

  // topic
  if (typeof obj.topic !== "string" || !(obj.topic as string).trim()) {
    obj.topic = "雑談";
  }

  // lines — speakerの正規化
  if (Array.isArray(obj.lines)) {
    obj.lines = (obj.lines as unknown[])
      .map((line, i) => {
        if (!isRecord(line)) return null;
        const text = typeof line.text === "string" ? (line.text as string).trim() : "";
        if (!text) return null;
        const speakerRaw = typeof line.speaker === "string" ? line.speaker : undefined;
        const speaker = speakerRaw && participantSet.has(speakerRaw)
          ? speakerRaw
          : ctx.participants[i % ctx.participants.length];
        return { speaker, text };
      })
      .filter(Boolean);
  }

  // metaの正規化
  const meta = isRecord(obj.meta) ? { ...(obj.meta as Record<string, unknown>) } : {};

  // memory の存在保証
  if (!isRecord(meta.memory)) {
    meta.memory = {
      summary: "",
      topicsCovered: [],
      unresolvedThreads: [],
      knowledgeGained: [],
    };
  }

  obj.meta = meta;
  return obj;
}

// ---------------------------------------------------------------------------
// GPTリクエスト
// ---------------------------------------------------------------------------

async function requestConversationOutput(
  systemPrompt: string,
  userPrompt: string,
  ctx: { threadId: string; participants: [string, string] },
): Promise<ConversationOutput> {
  const res = await client.responses.create({
    model: "gpt-5.1",
    temperature: 0.8,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: userPrompt }],
      },
    ],
    text: {
      format: {
        name: conversationResponseSchema.name,
        type: "json_schema",
        schema: conversationResponseSchema.schema,
        strict: conversationResponseSchema.strict,
      },
    },
  } as ResponseCreateParamsWithFormat);

  const content = extractTextFromResponse(res);
  if (!content) {
    throw new Error("[callGpt] GPT returned empty response.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (error) {
    console.error("[callGpt] JSON parse failed", { content });
    throw error;
  }

  const sanitized = sanitizeOutput(raw, ctx);
  const parsed = conversationOutputSchema.safeParse(sanitized);
  if (!parsed.success) {
    console.error("[callGpt] GPT出力が不正です:", parsed.error);
    throw new Error("Invalid GPT output format.");
  }

  return parsed.data;
}

// ---------------------------------------------------------------------------
// メインエントリポイント
// ---------------------------------------------------------------------------

export type CallGptResult = {
  output: ConversationOutput;
  retried: boolean;
  violations: string[];
};

/**
 * 会話生成: プロンプト構築 → GPT呼び出し → 検証 → リトライ(1回) → 結果返却
 */
export async function callGptForConversation(
  promptInput: PromptInput,
  structure: ConversationStructure,
  firstPersonMap: Record<string, string>,
): Promise<CallGptResult> {
  const sysPrompt = systemPromptConversation;
  const baseUserPrompt = buildUserPrompt(promptInput);
  const ctx = {
    threadId: promptInput.threadId,
    participants: [promptInput.characters[0].id, promptInput.characters[1].id] as [string, string],
  };

  try {
    let output = await requestConversationOutput(sysPrompt, baseUserPrompt, ctx);

    const validationInput: ValidationInput = {
      output,
      structure,
      firstPersonMap,
    };
    let result = validateConversationOutput(validationInput);

    // リトライ（最大1回）
    if (!result.valid) {
      const feedback = buildRetryFeedback(result);
      const retryPrompt = `${baseUserPrompt}\n\n【再生成指示】\n${feedback}`;
      output = await requestConversationOutput(sysPrompt, retryPrompt, ctx);

      const retryValidation = validateConversationOutput({
        output,
        structure,
        firstPersonMap,
      });

      if (!retryValidation.valid) {
        console.warn("[callGpt] Quality checks still failed after retry.", {
          violations: retryValidation.violations.map((v) => v.message),
        });
      }

      return {
        output,
        retried: true,
        violations: retryValidation.violations.map((v) => `[${v.severity}] ${v.message}`),
      };
    }

    return {
      output,
      retried: false,
      violations: result.violations.map((v) => `[${v.severity}] ${v.message}`),
    };
  } catch (error) {
    console.error("[callGpt] Failed to create conversation", {
      name: (error as Error)?.name,
      message: (error as Error)?.message,
    });
    throw error;
  }
}
