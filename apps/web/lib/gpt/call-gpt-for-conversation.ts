// apps/web/lib/gpt/call-gpt-for-conversation.ts
/**
 * @deprecated v1 GPT呼び出し。体験システム依存のグラウンディング検証を含む。
 * 代替: call-gpt-for-conversation-v2.ts
 */
import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { gptConversationOutputSchema, type GptConversationOutput } from "@repo/shared/gpt/schemas/conversation-output";
import { systemPromptConversation, buildUserPromptConversation } from "@repo/shared/gpt/prompts/conversation-prompt";
import { env } from "@/env";
import { assessConversationGrounding } from "@/lib/conversation/grounding";

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
            required: ["turnBalance", "tone"],
          },
          debug: {
            type: "array",
            items: { type: "string" },
          },
          anchorExperienceId: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          anchorSignature: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          grounded: {
            anyOf: [{ type: "boolean" }, { type: "null" }],
          },
          groundingEvidence: {
            type: "array",
            items: { type: "string" },
          },
          fallbackMode: { enum: ["experience", "continuation", "free"] },
        },
        required: [
          "tags",
          "newKnowledge",
          "signals",
          "qualityHints",
          "debug",
          "anchorExperienceId",
          "anchorSignature",
          "grounded",
          "groundingEvidence",
          "fallbackMode",
        ],
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
        name: string;
        type: "json_schema";
        schema: typeof conversationResponseSchema.schema;
        strict?: boolean;
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

const BRIDGE_PHRASES = [
  "そういえば",
  "ところで",
  "その話で言うと",
  "関連して",
  "話は変わるけど",
] as const;

const GENERIC_TOPICS = new Set(["雑談", "日常", "近況", "フリートーク", "会話"]);
const CONTINUITY_THRESHOLD = 0.08;
const MAX_RETRY_COUNT = 1;

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

function hasOutputText(res: unknown): res is ResponsesCreateReturn & { output_text: string[] } {
  return typeof res === "object" && res !== null && "output_text" in res;
}

function hasOutput(res: unknown): res is ResponsesCreateReturn & { output: unknown } {
  return typeof res === "object" && res !== null && "output" in res;
}

function extractTextFromResponse(res: unknown): string | null {
  if (!res) return null;
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

function normalizeTextForSimilarity(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[「」『』（）()【】\[\]、。,.!?！？:：;；"'`]/g, "")
    .trim();
}

function toBigrams(text: string): Set<string> {
  const normalized = normalizeTextForSimilarity(text);
  const grams = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i += 1) {
    grams.add(normalized.slice(i, i + 2));
  }
  return grams;
}

function bigramSimilarity(lhs: string, rhs: string): number {
  const a = toBigrams(lhs);
  const b = toBigrams(rhs);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const gram of a) {
    if (b.has(gram)) intersection += 1;
  }
  const union = new Set([...a, ...b]).size;
  if (union === 0) return 0;
  return intersection / union;
}

function extractTopicTerms(topic: string): string[] {
  const raw = topic.match(/[A-Za-z0-9\u3040-\u30ff\u3400-\u9fff]+/g) ?? [];
  const terms = raw
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .filter((term) => !GENERIC_TOPICS.has(term));
  return Array.from(new Set(terms));
}

export function containsBridgePhrase(text: string): boolean {
  const line = text.trim();
  if (!line) return false;
  return BRIDGE_PHRASES.some((phrase) => line.includes(phrase));
}

export function assessTopicContinuity(input: {
  topic: string;
  lines: Array<{ speaker: string; text: string }>;
  tags?: string[];
  recentLines?: Array<{ speaker: string; text: string }>;
}): {
  ok: boolean;
  reasons: string[];
  lowContinuityTurnIndexes: number[];
  topicReferenceCount: number;
} {
  const lines = Array.isArray(input.lines) ? input.lines : [];
  const tags = Array.isArray(input.tags) ? input.tags : [];
  const recentLines = Array.isArray(input.recentLines) ? input.recentLines : [];
  const hasTopicShift = tags.includes("topic_shift");
  const reasons: string[] = [];
  const lowContinuityTurnIndexes: number[] = [];

  const pushLowIfNeeded = (index: number, previousText: string, currentText: string) => {
    const sim = bigramSimilarity(previousText, currentText);
    if (sim < CONTINUITY_THRESHOLD) lowContinuityTurnIndexes.push(index);
  };

  const prev = recentLines[recentLines.length - 1];
  if (prev && lines[0]) {
    pushLowIfNeeded(0, prev.text, lines[0].text);
  }
  for (let i = 1; i < lines.length; i += 1) {
    pushLowIfNeeded(i, lines[i - 1].text, lines[i].text);
  }

  const lowTurnsWithoutBridge = lowContinuityTurnIndexes.filter((index) => {
    const line = lines[index];
    return !line || !containsBridgePhrase(line.text);
  });

  if (lowContinuityTurnIndexes.length > 0 && !hasTopicShift) {
    reasons.push("低連続性ターンがあるが topic_shift タグがありません。");
  }
  if (lowTurnsWithoutBridge.length > 0) {
    reasons.push("低連続性ターンに橋渡し表現がありません。");
  }

  const topicTerms = extractTopicTerms(input.topic);
  let topicReferenceCount = 0;
  if (topicTerms.length > 0) {
    topicReferenceCount = lines.reduce((count, line) => {
      const text = line?.text ?? "";
      const hit = topicTerms.some((term) => {
        return text.includes(term) || text.toLowerCase().includes(term.toLowerCase());
      });
      return hit ? count + 1 : count;
    }, 0);
    if (topicReferenceCount === 0) {
      reasons.push("会話全体で話題語への参照がありません。");
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    lowContinuityTurnIndexes,
    topicReferenceCount,
  };
}

function buildRetryPrompt(basePrompt: string, reasons: string[]): string {
  if (reasons.length === 0) return basePrompt;
  return `${basePrompt}

【再生成指示】
以下の理由で品質チェックに失敗しました。会話を作り直してください。
${reasons.map((reason) => `- ${reason}`).join("\n")}
- 主題は維持し、切り替える場合は橋渡し表現を入れ、meta.tags に "topic_shift" を含めてください。
- fallbackMode が experience の場合は anchorFact / appraisal / hookIntent に接地してください。`;
}

async function requestConversationOutput(
  systemPrompt: string,
  userPrompt: string,
  params: Parameters<typeof buildUserPromptConversation>[0],
): Promise<GptConversationOutput> {
  const res = await client.responses.create({
    model: "gpt-5.1",
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
        name: conversationResponseSchema.name,
        type: "json_schema",
        schema: conversationResponseSchema.schema,
        strict: conversationResponseSchema.strict,
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
    fallbackMode: params.brief.fallbackMode,
    anchorExperienceId: params.brief.anchorExperienceId,
  });

  const parsed = gptConversationOutputSchema.safeParse(sanitized);
  if (!parsed.success) {
    console.error("GPT出力が不正です:", parsed.error);
    throw new Error("Invalid GPT output format.");
  }

  return parsed.data;
}

export async function callGptForConversation(
  params: Parameters<typeof buildUserPromptConversation>[0],
): Promise<GptConversationOutput> {
  const systemPrompt = systemPromptConversation;
  const baseUserPrompt = buildUserPromptConversation(params);

  try {
    let userPrompt = baseUserPrompt;
    let out = await requestConversationOutput(systemPrompt, userPrompt, params);
    let continuity = assessTopicContinuity({
      topic: out.topic,
      lines: out.lines,
      tags: out.meta?.tags,
      recentLines: params.pairContext?.recentLines,
    });
    let grounding = assessConversationGrounding({
      brief: params.brief,
      lines: out.lines,
    });
    const collectRetryReasons = () => {
      const reasons = [...continuity.reasons];
      if (!grounding.ok) reasons.push(...grounding.reasons);
      return Array.from(new Set(reasons));
    };

    for (let retry = 0; retry < MAX_RETRY_COUNT; retry += 1) {
      const retryReasons = collectRetryReasons();
      if (retryReasons.length === 0) break;
      userPrompt = buildRetryPrompt(baseUserPrompt, retryReasons);
      out = await requestConversationOutput(systemPrompt, userPrompt, params);
      continuity = assessTopicContinuity({
        topic: out.topic,
        lines: out.lines,
        tags: out.meta?.tags,
        recentLines: params.pairContext?.recentLines,
      });
      grounding = assessConversationGrounding({
        brief: params.brief,
        lines: out.lines,
      });
    }

    const finalReasons = collectRetryReasons();
    if (finalReasons.length > 0) {
      console.warn("[callGptForConversation] Quality checks still failed after retry.", {
        reasons: finalReasons,
      });
    }

    return out;
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
  ctx: {
    threadId: string;
    participants: [string, string];
    fallbackMode: "experience" | "continuation" | "free";
    anchorExperienceId?: string;
  },
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
    : [];

  const qualityHintsInput = isRecord((metaInput as any).qualityHints)
    ? ((metaInput as any).qualityHints as Record<string, unknown>)
    : {};
  const qualityHints = {
    turnBalance:
      qualityHintsInput?.turnBalance === "balanced" || qualityHintsInput?.turnBalance === "skewed"
        ? (qualityHintsInput.turnBalance as "balanced" | "skewed")
        : "balanced",
    tone:
      typeof qualityHintsInput?.tone === "string" && qualityHintsInput.tone.trim().length > 0
        ? qualityHintsInput.tone.trim()
        : "neutral",
  };

  const debug = Array.isArray((metaInput as any).debug)
    ? (metaInput as any).debug.filter((item: unknown): item is string => typeof item === "string" && item.length > 0)
    : [];

  const anchorExperienceId = typeof (metaInput as any).anchorExperienceId === "string"
    && (metaInput as any).anchorExperienceId.trim().length > 0
    ? (metaInput as any).anchorExperienceId
    : ctx.anchorExperienceId;

  const anchorSignature = typeof (metaInput as any).anchorSignature === "string"
    && (metaInput as any).anchorSignature.trim().length > 0
    ? (metaInput as any).anchorSignature
    : undefined;

  const grounded = typeof (metaInput as any).grounded === "boolean"
    ? (metaInput as any).grounded
    : undefined;

  const groundingEvidence = Array.isArray((metaInput as any).groundingEvidence)
    ? (metaInput as any).groundingEvidence
        .filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 3)
    : [];

  const fallbackMode = (metaInput as any).fallbackMode === "experience"
    || (metaInput as any).fallbackMode === "continuation"
    || (metaInput as any).fallbackMode === "free"
    ? (metaInput as any).fallbackMode
    : ctx.fallbackMode;

  return {
    threadId: ctx.threadId,
    participants,
    topic,
    lines,
    meta: {
      tags,
      newKnowledge,
      signals,
      qualityHints,
      debug,
      anchorExperienceId,
      anchorSignature,
      grounded,
      groundingEvidence,
      fallbackMode,
    },
  } satisfies Partial<GptConversationOutput>;
}
