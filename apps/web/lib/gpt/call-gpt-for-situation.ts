// apps/web/lib/gpt/call-gpt-for-situation.ts
// シチュエーション（出会いの状況描写）をGPTで動的生成する

import OpenAI from "openai";
import { env } from "@/env";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type SituationInput = {
  characterA: { name: string; occupation?: string | null; interests: string[] };
  characterB: { name: string; occupation?: string | null; interests: string[] };
  relationType: string;
  timeOfDay: string;
  date: string;
  /** 直近の状況描写（重複回避用） */
  recentSituations: string[];
};

/** フォールバック用の固定パターン */
const FALLBACK_SITUATIONS = [
  "夕暮れの帰り道、角を曲がった先でばったり会った",
  "昼休みの廊下で同時に足を止め、目が合った",
  "雨宿りの軒先で並んだ瞬間、互いに気づいた",
  "本棚の前で同じ本に手を伸ばし、顔を見合わせた",
  "駅前の信号待ちで隣に立ち、自然に会話が始まった",
] as const;

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function charLength(value: string): number {
  return Array.from(value).length;
}

/**
 * GPT-5-mini で 20〜30文字の状況描写を生成する。
 * 失敗時はフォールバックの固定パターンを返す。
 */
export async function callGptForSituation(input: SituationInput): Promise<string> {
  const system = `あなたは生活シミュレーションゲームの状況描写を生成するAIです。
2人のキャラクターが偶然出会う状況を、20〜30文字の短い描写で1つだけ返してください。
説明や補足は不要。描写テキストのみを返してください。`;

  const recentPart = input.recentSituations.length > 0
    ? `\n以下の状況は直近で使ったため避けてください:\n${input.recentSituations.map(s => `- ${s}`).join("\n")}`
    : "";

  const user = `キャラA: ${input.characterA.name}${input.characterA.occupation ? `（${input.characterA.occupation}）` : ""}
キャラB: ${input.characterB.name}${input.characterB.occupation ? `（${input.characterB.occupation}）` : ""}
関係: ${input.relationType}
時間帯: ${input.timeOfDay}
日付: ${input.date}${recentPart}

20〜30文字の状況描写を1つだけ生成してください。`;

  const pickFallbackSituation = () => {
    const candidates = FALLBACK_SITUATIONS.filter((s) => !input.recentSituations.includes(s));
    return pickRandom(candidates.length > 0 ? candidates : FALLBACK_SITUATIONS);
  };

  try {
    const res = await client.responses.create({
      model: "gpt-5-mini",
      temperature: 0.9,
      max_output_tokens: 60,
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
    });

    const text = "output_text" in res && typeof res.output_text === "string"
      ? res.output_text.trim()
      : null;

    if (text && charLength(text) >= 20 && charLength(text) <= 30) {
      return text;
    }

    return pickFallbackSituation();
  } catch (error) {
    console.warn("[callGptForSituation] GPT call failed, using fallback.", error);
    return pickFallbackSituation();
  }
}
