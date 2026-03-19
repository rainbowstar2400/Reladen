// apps/web/lib/gpt/call-gpt-for-nickname.ts
// ニックネーム自動生成の GPT 呼び出し

import OpenAI from "openai";
import { env } from "@/env";
import { buildNicknamePrompt } from "@repo/shared/gpt/prompts/nickname-prompt";
import type { NicknameGenerationInput } from "@repo/shared/logic/nickname";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type NicknameOutput = {
  nicknameAtoB: string;
  nicknameBtoA: string;
};

const NICKNAME_JSON_SCHEMA = {
  name: "nickname_output",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      nicknameAtoB: { type: "string" as const, description: "AがBを呼ぶ呼び名" },
      nicknameBtoA: { type: "string" as const, description: "BがAを呼ぶ呼び名" },
    },
    required: ["nicknameAtoB", "nicknameBtoA"],
    additionalProperties: false,
  },
};

/** フォールバック: さん付け */
function fallbackNicknames(input: NicknameGenerationInput): NicknameOutput {
  const nameA = input.characterA.name;
  const nameB = input.characterB.name;
  return {
    nicknameAtoB: `${nameB}さん`,
    nicknameBtoA: `${nameA}さん`,
  };
}

export async function callGptForNickname(
  input: NicknameGenerationInput,
): Promise<NicknameOutput> {
  const { system, user } = buildNicknamePrompt(input);

  try {
    const res = await client.responses.create({
      model: "gpt-5-mini",
      temperature: 0.8,
      max_output_tokens: 150,
      instructions: system,
      input: user,
      text: {
        format: {
          type: "json_schema",
          ...NICKNAME_JSON_SCHEMA,
        },
      },
    });

    const text = res.output_text;
    if (!text) return fallbackNicknames(input);

    const parsed = JSON.parse(text);
    if (
      typeof parsed.nicknameAtoB === "string" &&
      typeof parsed.nicknameBtoA === "string" &&
      parsed.nicknameAtoB.length > 0 &&
      parsed.nicknameBtoA.length > 0
    ) {
      return {
        nicknameAtoB: parsed.nicknameAtoB,
        nicknameBtoA: parsed.nicknameBtoA,
      };
    }

    return fallbackNicknames(input);
  } catch (error) {
    console.warn("[callGptForNickname] GPT call failed, using fallback.", error);
    return fallbackNicknames(input);
  }
}
