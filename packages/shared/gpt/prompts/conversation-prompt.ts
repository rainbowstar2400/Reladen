// packages/shared/gpt/prompts/conversation-prompt.ts
// 会話生成プロンプトビルダー
// 「コードが"何を"、LLMが"どう言うか"」の原則に基づく

import type {
  SpeechProfile,
  ConversationStructure,
  SelectedTopic,
  ConversationMemory,
  SharedSnippet,
  Traits,
} from "@repo/shared/types/conversation-generation";

import {
  formatTraitDescriptions,
  formatMbtiDescription,
} from "./trait-descriptions";

// ---------------------------------------------------------------------------
// 入力型定義
// ---------------------------------------------------------------------------

/** プロンプトに必要なキャラクター情報 */
export type CharacterProfile = {
  id: string;
  name: string;
  gender?: string | null;
  age?: number | null;
  occupation?: string | null;
  firstPerson?: string | null;
  mbti?: string | null;
  traits: Partial<Traits>;
  interests: string[];
  speechProfile?: SpeechProfile | null;
};

/** プロンプト構築の全入力 */
export type PromptInput = {
  characters: [CharacterProfile, CharacterProfile];
  relation: {
    type: string;
    feelingAtoB: { label: string; score: number };
    feelingBtoA: { label: string; score: number };
  };
  structure: ConversationStructure;
  topic: SelectedTopic;
  environment: { place: string; timeOfDay: string; weather?: string };
  recentSnippets: SharedSnippet[];
  previousMemory: ConversationMemory | null;
  threadId: string;
};

// ---------------------------------------------------------------------------
// システムプロンプト
// ---------------------------------------------------------------------------

export const systemPromptConversation = `
あなたはキャラクター2人の自然な会話を生成するAIです。
出力は必ず「正しいJSONのみ」を返し、説明文や補足を付けないでください。

出力JSONスキーマ:
{
  "threadId": string,
  "participants": [string, string],
  "topic": string,
  "lines": [
    { "speaker": string, "text": string }
  ],
  "meta": {
    "tags": string[],
    "signals": ["continue"|"close"|"park"],
    "qualityHints": {
      "turnBalance": "balanced"|"skewed",
      "tone": string
    },
    "debug": string[],
    "memory": {
      "summary": string,
      "topicsCovered": string[],
      "unresolvedThreads": string[],
      "knowledgeGained": [
        { "about": string, "fact": string }
      ]
    }
  }
}

生成ルール:
- 各キャラの「話し方」セクションに記載された語尾・頻出表現を忠実に反映すること
- 「避ける表現」に記載された表現は絶対に使わないこと
- 一人称は指定表記を厳守し、表記揺れ・別表記への変換を行わないこと
- 「会話の構造」セクションの主導権・スタンス・温度感・ターンバランスに従うこと
- memoryは会話内容から正確に抽出すること
`.trim();

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function relationLabel(type: string): string {
  switch (type) {
    case "acquaintance": return "知人";
    case "friend": return "友人";
    case "best_friend": return "親友";
    case "lover": return "恋人";
    case "family": return "家族";
    case "none": return "関係なし";
    default: return type || "不明";
  }
}

function feelingLabel(label: string): string {
  switch (label) {
    case "none": return "なし";
    case "dislike": return "嫌い";
    case "maybe_dislike": return "嫌いかも";
    case "curious": return "気になる";
    case "maybe_like": return "好きかも";
    case "like": return "好き";
    case "love": return "愛情";
    case "awkward": return "気まずい";
    default: return label || "不明";
  }
}

function stanceLabel(stance: string): string {
  switch (stance) {
    case "enthusiastic": return "乗り気。具体例を出して盛り上げる";
    case "agreeable": return "穏やかに付き合う。反応は短め";
    case "reluctant": return "面倒だが付き合う。最低限の返事";
    case "indifferent": return "興味薄。短く返す";
    case "confrontational": return "反論気味。突っかかる";
    default: return stance;
  }
}

function temperatureLabel(temp: string): string {
  switch (temp) {
    case "warm": return "和やかに盛り上がる";
    case "lukewarm": return "ぎこちない";
    case "neutral": return "普通";
    case "tense": return "緊張感がある";
    default: return temp;
  }
}

function topicSourceLabel(source: string): string {
  switch (source) {
    case "shared_interest": return "共通の興味";
    case "personal_interest": return "個人の興味";
    case "continuation": return "前回の続き";
    case "snippet": return "共有の出来事";
    case "third_party": return "第三者の話題";
    case "feeling_shift": return "関係性の変化";
    case "environmental": return "環境";
    default: return source;
  }
}

// ---------------------------------------------------------------------------
// キャラクターブロック
// ---------------------------------------------------------------------------

function formatCharacterBlock(char: CharacterProfile): string {
  const lines: string[] = [];

  // 基本属性行
  const attrParts: string[] = [];
  if (char.gender) attrParts.push(`性別: ${char.gender}`);
  if (typeof char.age === "number") attrParts.push(`年齢: ${char.age}`);
  if (char.occupation) attrParts.push(`職業: ${char.occupation}`);
  if (char.firstPerson) attrParts.push(`一人称: ${char.firstPerson}`);

  lines.push(`- ${char.name} (ID: ${char.id})`);
  if (attrParts.length > 0) {
    lines.push(`  ${attrParts.join(" / ")}`);
  }

  // MBTI（認知スタイル）
  const mbtiLine = formatMbtiDescription(char.mbti);
  if (mbtiLine) {
    lines.push(`  ${mbtiLine}`);
  }

  // 5特性（行動記述）
  const traitLine = formatTraitDescriptions(char.traits);
  lines.push(`  ${traitLine}`);

  // 口調プロファイル
  if (char.speechProfile) {
    const sp = char.speechProfile;
    lines.push(`  話し方「${sp.label}」:`);
    lines.push(`    語尾: ${sp.endings.join(" / ")}`);
    if (sp.frequentPhrases.length > 0) {
      lines.push(`    よく使う表現: ${sp.frequentPhrases.join(", ")}`);
    }
    if (sp.avoidedPhrases.length > 0) {
      lines.push(`    避ける表現: ${sp.avoidedPhrases.join(", ")}`);
    }
    if (sp.examples.length > 0) {
      lines.push("    例:");
      for (const ex of sp.examples) {
        lines.push(`      - 「${ex}」`);
      }
    }
  } else {
    lines.push("  話し方: 未設定（自然な話し方で生成）");
  }

  // 一人称厳守指示
  if (char.firstPerson) {
    lines.push(`  一人称は「${char.firstPerson}」を厳守すること。`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// ユーザープロンプト構築
// ---------------------------------------------------------------------------

export function buildUserPrompt(input: PromptInput): string {
  const [charA, charB] = input.characters;
  const { structure, topic, relation, environment } = input;

  const sections: string[] = [];

  // 【会話設定】
  const settingParts = [`場所: ${environment.place}（${environment.timeOfDay}`];
  if (environment.weather) settingParts[0] += `、${environment.weather}`;
  settingParts[0] += "、偶然鉢合わせ）";

  sections.push(`【会話設定】\n${settingParts[0]}`);

  // 【登場人物】
  sections.push(
    `【登場人物】\n${formatCharacterBlock(charA)}\n\n${formatCharacterBlock(charB)}`,
  );

  // 【2人の関係性と現在の感情】
  const aName = charA.name;
  const bName = charB.name;
  const relationBlock = [
    `- 関係性: ${relationLabel(relation.type)}`,
    `- ${aName}→${bName}: ${feelingLabel(relation.feelingAtoB.label)} / スコア=${relation.feelingAtoB.score}`,
    `- ${bName}→${aName}: ${feelingLabel(relation.feelingBtoA.label)} / スコア=${relation.feelingBtoA.score}`,
  ].join("\n");
  sections.push(`【2人の関係性と現在の感情】\n${relationBlock}`);

  // 【会話の構造】
  const structureBlock = [
    `- 主導: ${structure.initiatorName}（話題を振る側）`,
    `- ${structure.initiatorName}のスタンス: ${structure.initiatorStance}（${stanceLabel(structure.initiatorStance)}）`,
    `- ${structure.responderName}のスタンス: ${structure.responderStance}（${stanceLabel(structure.responderStance)}）`,
    `- 温度感: ${structure.temperature}（${temperatureLabel(structure.temperature)}）`,
    `- ${structure.initiatorName}の発話は${structure.initiatorTurnLength}、${structure.responderName}の発話は${structure.responderTurnLength}`,
  ].join("\n");
  sections.push(`【会話の構造】\n${structureBlock}`);

  // 【話題】
  const topicLines = [
    `種別: ${topicSourceLabel(topic.source)}`,
    `内容: ${topic.label}`,
  ];
  if (topic.detail) {
    topicLines.push(`補足: ${topic.detail}`);
  }
  if (topic.thirdPartyContext) {
    const ctx = topic.thirdPartyContext;
    topicLines.push(`${structure.initiatorName}が知っていること:`);
    for (const fact of ctx.knownFacts) {
      topicLines.push(`  - ${fact}`);
    }
    topicLines.push(
      `${structure.responderName}と${ctx.characterName}の関係: ${ctx.listenerKnowsCharacter ? "知り合い" : "なし（直接は知らない）"}`,
    );
    topicLines.push(`注意: ${structure.initiatorName}の知識の範囲内でのみ${ctx.characterName}について言及すること`);
  }
  sections.push(`【話題】\n${topicLines.join("\n")}`);

  // 【直近の共有スニペット】（あれば）
  if (input.recentSnippets.length > 0) {
    const snippetLines = input.recentSnippets.map((s) => `- ${s.text}`);
    sections.push(`【直近の共有スニペット】\n${snippetLines.join("\n")}`);
  }

  // 【前回の会話記憶】（あれば）
  if (input.previousMemory) {
    const mem = input.previousMemory;
    const memLines = [
      `要約: ${mem.summary}`,
      `話した話題: ${mem.topicsCovered.join(", ")}`,
    ];
    if (mem.unresolvedThreads.length > 0) {
      memLines.push(`未解決の話題: ${mem.unresolvedThreads.join(", ")}`);
    }
    if (mem.knowledgeGained.length > 0) {
      memLines.push("知ったこと:");
      for (const k of mem.knowledgeGained) {
        // about はIDなので、名前で表示
        const aboutName = k.about === charA.id ? charA.name
          : k.about === charB.id ? charB.name
          : k.about;
        memLines.push(`  - ${aboutName}について: ${k.fact}`);
      }
    }
    sections.push(`【前回の会話記憶】\n${memLines.join("\n")}`);
  }

  // 【生成ルール】
  const rules = [
    "- 上記の構造（主導権、スタンス、温度感、ターンバランス）に従うこと",
    "- 6〜8ターンの会話を生成",
    "- 1発話は1文を基本",
    "- 話し方の語尾・頻出表現を口調に反映し、避ける表現は使わないこと",
    "- 一人称は指定表記を厳守（表記揺れ禁止）",
    "- 相手の直前発話を受けた返答を優先する",
    "- 関連のない新話題を唐突に導入しない",
    "- 汎用テンプレ台詞の連発は避ける",
  ];

  // 話題ソースに応じた追加ルール
  if (topic.source === "continuation" && input.previousMemory) {
    rules.push("- 前回の未解決の話題を自然に再開すること");
  }
  if (topic.source === "snippet") {
    rules.push("- 共有スニペットの出来事を会話のきっかけに使うこと");
  }

  sections.push(`【生成ルール】\n${rules.join("\n")}`);

  // 【出力仕様】
  const outputRules = [
    "- 出力は上記スキーマに厳密一致するJSONのみ",
    `- threadId: "${input.threadId}"`,
    `- participants: ["${charA.id}", "${charB.id}"]`,
    "- lines[].speaker は必ず participants のどちらかにする",
    `- lines[0].speaker は主導者(${structure.initiatorId})にすること`,
    "- meta.memory は会話内容を正確に反映した構造化記憶",
    "- meta.memory.knowledgeGained[].about はキャラIDを使うこと",
  ];
  sections.push(`【出力仕様】\n${outputRules.join("\n")}`);

  return sections.join("\n\n");
}
