// packages/shared/gpt/prompts/peek-prompt.ts
// 覗く機能のプロンプトビルダー

import type { Traits } from "@repo/shared/types/conversation-generation";
import { formatTraitDescriptions, formatMbtiDescription } from "./trait-descriptions";

export type PeekPromptInput = {
  character: {
    name: string;
    gender?: string | null;
    age?: number | null;
    occupation?: string | null;
    mbti?: string | null;
    traits: Partial<Traits>;
    interests: string[];
  };
  environment: {
    timeOfDay: string;
    weather?: string;
  };
  /** 直近の会話イベントの要約（最大3件） */
  recentEventSummaries: string[];
};

export function buildPeekPrompt(input: PeekPromptInput): {
  system: string;
  user: string;
} {
  const { character: c, environment: env, recentEventSummaries } = input;

  const system = `あなたは生活シミュレーションゲームのキャラクター描写を生成するAIです。
指定されたキャラクターの「今の様子」を2つの枠で生成してください。

## 出力形式（JSON）
{
  "situation": "今何をしているかの短文（30-50文字）",
  "monologue": "キャラらしい独り言（20-40文字）"
}

## ルール
- situation: 場所・行動・雰囲気を含む客観的な状況描写。心情は含めない。
- monologue: キャラクターの口調に合った独り言。心情描写ではなく、つぶやき。
- 直近の出来事は参考程度に。日常の一コマを描写すること。
- JSON以外の出力は一切不要。`;

  const traitDesc = formatTraitDescriptions(c.traits);
  const mbtiDesc = c.mbti ? formatMbtiDescription(c.mbti) : null;
  const interestsPart = c.interests.length > 0 ? `興味・関心: ${c.interests.join("、")}` : "";
  const occupationPart = c.occupation ? `職業: ${c.occupation}` : "";
  const recentPart = recentEventSummaries.length > 0
    ? `\n直近の出来事（参考程度）:\n${recentEventSummaries.map(s => `- ${s}`).join("\n")}`
    : "";

  const user = `キャラクター: ${c.name}${c.gender ? `（${c.gender}）` : ""}${c.age ? `、${c.age}歳` : ""}
${occupationPart}
${interestsPart}
性格: ${traitDesc}${mbtiDesc ? `\nMBTI: ${mbtiDesc}` : ""}
時間帯: ${env.timeOfDay}
天気: ${env.weather ?? "不明"}${recentPart}

このキャラクターの今の様子をJSON形式で生成してください。`;

  return { system, user };
}
