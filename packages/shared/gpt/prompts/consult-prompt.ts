// packages/shared/gpt/prompts/consult-prompt.ts
// 相談システムのプロンプトビルダー

import type { Traits } from "@repo/shared/types/conversation-generation";
import { formatTraitDescriptions, formatMbtiDescription } from "./trait-descriptions";

// ---------------------------------------------------------------------------
// 共通型
// ---------------------------------------------------------------------------

type CharacterInfo = {
  name: string;
  gender?: string | null;
  age?: number | null;
  mbti?: string | null;
  traits: Partial<Traits>;
  speechProfileSummary?: string | null;
};

// ---------------------------------------------------------------------------
// テーマ生成プロンプト
// ---------------------------------------------------------------------------

export type ThemePromptInput = {
  character: CharacterInfo;
  trustBandTone: string;
  category: string;
  seed: string;
  recentSummaries: string[];
  playerName?: string;
};

export function buildThemePrompt(input: ThemePromptInput): {
  system: string;
  user: string;
} {
  const { character: c, trustBandTone, category, seed, recentSummaries, playerName } = input;
  const playerLabel = playerName ? `${playerName}（管理人）` : 'プレイヤー（管理人）';

  const system = `あなたは生活シミュレーションゲームの相談テキストを生成するAIです。
住人が${playerLabel}に相談を持ちかけるシーンを生成してください。

## 出力形式（JSON）
{
  "title": "相談タイトル（15-25文字）",
  "content": "相談本文（50-100文字、キャラの口調・態度で）",
  "choices": [
    { "id": "c1", "label": "選択肢1" },
    { "id": "c2", "label": "選択肢2" },
    { "id": "c3", "label": "選択肢3" }
  ]
}

## ルール
- content はキャラクターの口調と信頼度帯の態度で書くこと
- choices は 3つ。${playerLabel}の返答として自然なバリエーション（肯定的・中立・否定的 の3段階）
- 相談は「ちょっと深いけど重すぎない」程度の深さ
- JSON以外の出力は一切不要`;

  const traitDesc = formatTraitDescriptions(c.traits);
  const mbtiDesc = c.mbti ? formatMbtiDescription(c.mbti) : null;
  const recentPart =
    recentSummaries.length > 0
      ? `\n最近の出来事（参考程度）:\n${recentSummaries.map((s) => `- ${s}`).join("\n")}`
      : "";
  const speechPart = c.speechProfileSummary ? `口調: ${c.speechProfileSummary}` : "";

  const user = `キャラクター: ${c.name}${c.gender ? `（${c.gender}）` : ""}${c.age ? `、${c.age}歳` : ""}
性格: ${traitDesc}${mbtiDesc ? `\nMBTI: ${mbtiDesc}` : ""}
${speechPart}
${playerLabel}への態度: ${trustBandTone}
テーマカテゴリ: ${category}
テーマシード: ${seed}${recentPart}

この設定で相談テキストと選択肢をJSON形式で生成してください。`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// 返答生成プロンプト
// ---------------------------------------------------------------------------

export type ReplyPromptInput = {
  character: CharacterInfo;
  trustBandTone: string;
  consultContent: string;
  selectedChoiceLabel: string;
  playerName?: string;
};

export function buildReplyPrompt(input: ReplyPromptInput): {
  system: string;
  user: string;
} {
  const { character: c, trustBandTone, consultContent, selectedChoiceLabel, playerName } = input;
  const playerLabel = playerName ? `${playerName}（管理人）` : 'プレイヤー（管理人）';

  const system = `あなたは生活シミュレーションゲームのキャラクター返答を生成するAIです。
住人が${playerLabel}の回答を聞いた後のリアクションを生成してください。

## 出力形式（JSON）
{
  "reply": "返答テキスト（30-80文字、キャラの口調で）",
  "favorability": "positive" | "neutral" | "negative"
}

## ルール
- reply: ${playerLabel}の選択に対するキャラクターの自然な反応。口調を守ること。
- favorability: ${playerLabel}の回答がキャラクターにとってどう受け止められたか
  - positive: 嬉しい・心強い・前向き
  - neutral: まあそうだよね、程度
  - negative: がっかり・不満・納得いかない
- JSON以外の出力は一切不要`;

  const traitDesc = formatTraitDescriptions(c.traits);
  const speechPart = c.speechProfileSummary ? `口調: ${c.speechProfileSummary}` : "";

  const user = `キャラクター: ${c.name}
性格: ${traitDesc}
${speechPart}
${playerLabel}への態度: ${trustBandTone}

相談内容:
${consultContent}

${playerLabel}の回答: ${selectedChoiceLabel}

この回答に対するキャラクターの返答と好ましさをJSON形式で生成してください。`;

  return { system, user };
}
