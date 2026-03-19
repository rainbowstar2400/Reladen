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

/** ペア間のニックネーム情報 */
export type NicknameInfo = {
  /** A が B を呼ぶ呼び名 */
  aCallsB?: string | null;
  /** B が A を呼ぶ呼び名 */
  bCallsA?: string | null;
};

/** プロンプト構築の全入力 */
export type PromptInput = {
  characters: [CharacterProfile, CharacterProfile];
  relation: {
    type: string;
    familySubType?: string | null;
    feelingAtoB: { label: string; score: number };
    feelingBtoA: { label: string; score: number };
  };
  structure: ConversationStructure;
  topic: SelectedTopic;
  environment: { place: string; timeOfDay: string; weather?: string };
  /** ゲーム内日付（例: "3月17日"） */
  gameDate?: string;
  recentSnippets: SharedSnippet[];
  previousMemory: ConversationMemory | null;
  threadId: string;
  /** シチュエーション描写（外部で生成済み） */
  situation?: string;
  /** 会話タイプ（通常/約束生成/約束履行） */
  conversationType?: 'normal' | 'promise_generation' | 'promise_fulfillment';
  /** ニックネーム情報（D-3） */
  nicknames?: NicknameInfo;
};

// ---------------------------------------------------------------------------
// システムプロンプト（few-shot例つき）
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
- 各キャラの「口調ルール」セクションに記載された語尾・頻出表現を忠実に反映すること
- 「避ける表現」に記載された表現は絶対に使わないこと
- 一人称は指定表記を厳守し、表記揺れ・別表記への変換を行わないこと
- 「会話の方向」セクションの主導権・スタンス・温度感・ターンバランスに従うこと
- memoryは会話内容から正確に抽出すること

【理想の会話例】
設定: 友人同士、共通の興味（料理）、商店街で偶然会う、warm
A: 一人称「俺」、語尾「〜じゃん」「〜だろ」
B: 一人称「私」、語尾「〜だよね」「〜かな」

{"lines":[
  {"speaker":"A","text":"買い物帰り？ すごい荷物じゃん。"},
  {"speaker":"B","text":"安売りしてて、つい買いすぎちゃった。"},
  {"speaker":"A","text":"わかる。俺も昨日アボカド98円につられて3つ買ったわ。"},
  {"speaker":"B","text":"3つは多いよね。何作るの？"},
  {"speaker":"A","text":"アボカド丼かなー。レパートリー少なくてさ。"},
  {"speaker":"B","text":"私も最近同じのばっかり。今度一緒に新しいの作ってみない？"}
]}

この例のポイント:
- 冒頭は相手の状況を見て声をかけている（テンプレ挨拶ではない）
- 具体物（アボカド、98円、3つ）で会話が展開している
- 語尾が自然に使われ、一人称の表記揺れがない
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
    case "self_experience": return "自分の最近の出来事";
    case "heart_to_heart": return "お互いを知る";
    case "small_talk": return "世間話";
    case "seasonal": return "季節の話題";
    default: return source;
  }
}

// ---------------------------------------------------------------------------
// 口調ルールブロック（プロンプト先頭用・最重要）
// ---------------------------------------------------------------------------

function formatSpeechRuleBlock(char: CharacterProfile): string {
  const lines: string[] = [];
  lines.push(`■ ${char.name}:`);

  // 一人称（最優先）
  if (char.firstPerson) {
    lines.push(`  一人称: 「${char.firstPerson}」（厳守・表記揺れ禁止・自分の名前で自己言及しない）`);
  }

  // 口調プロファイル
  if (char.speechProfile) {
    const sp = char.speechProfile;
    lines.push(`  語尾: ${sp.endings.join(" / ")}`);
    if (sp.frequentPhrases.length > 0) {
      lines.push(`  よく使う表現: ${sp.frequentPhrases.join(", ")}`);
    }
    if (sp.avoidedPhrases.length > 0) {
      lines.push(`  避ける表現: ${sp.avoidedPhrases.join(", ")}`);
    }
    if (sp.examples.length > 0) {
      lines.push(`  セリフ例: ${sp.examples.map((ex) => `「${ex}」`).join(" ")}`);
    }
  } else {
    lines.push("  話し方: 未設定（自然な話し方で生成）");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// キャラクター補足ブロック（基本属性・MBTI・特性のみ）
// ---------------------------------------------------------------------------

function formatCharacterBlock(char: CharacterProfile): string {
  const lines: string[] = [];

  // 基本属性行
  const attrParts: string[] = [];
  if (char.gender) attrParts.push(`性別: ${char.gender}`);
  if (typeof char.age === "number") attrParts.push(`年齢: ${char.age}`);
  if (char.occupation) attrParts.push(`職業: ${char.occupation}`);

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

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// ユーザープロンプト構築
// ---------------------------------------------------------------------------

export function buildUserPrompt(input: PromptInput): string {
  const [charA, charB] = input.characters;
  const { structure, topic, relation, environment } = input;

  const sections: string[] = [];

  // ====================================================================
  // 【最重要: 口調ルール】— プロンプト先頭に配置（primacy bias 活用）
  // ====================================================================
  sections.push(
    `【最重要: 口調ルール】\n以下の口調を各発話に必ず反映すること。\n\n${formatSpeechRuleBlock(charA)}\n\n${formatSpeechRuleBlock(charB)}`,
  );

  // ====================================================================
  // 【話題と会話の方向】— 会話の骨格を早期に把握させる
  // ====================================================================
  const directionLines: string[] = [];

  // 話題
  directionLines.push(`話題: ${topicSourceLabel(topic.source)}「${topic.label}」`);
  if (topic.detail) {
    directionLines.push(`  補足: ${topic.detail}`);
  }

  // 構造
  directionLines.push(`主導: ${structure.initiatorName}（話題を振る側）`);
  directionLines.push(`${structure.initiatorName}のスタンス: ${structure.initiatorStance}（${stanceLabel(structure.initiatorStance)}）`);
  directionLines.push(`${structure.responderName}のスタンス: ${structure.responderStance}（${stanceLabel(structure.responderStance)}）`);
  directionLines.push(`温度感: ${structure.temperature}（${temperatureLabel(structure.temperature)}）`);
  directionLines.push(`${structure.initiatorName}の発話は${structure.initiatorTurnLength}、${structure.responderName}の発話は${structure.responderTurnLength}`);

  // third_party コンテキスト
  if (topic.thirdPartyContext) {
    const ctx = topic.thirdPartyContext;
    directionLines.push(`${structure.initiatorName}が知っていること:`);
    for (const fact of ctx.knownFacts) {
      directionLines.push(`  - ${fact}`);
    }
    directionLines.push(
      `${structure.responderName}と${ctx.characterName}の関係: ${ctx.listenerKnowsCharacter ? "知り合い" : "なし（直接は知らない）"}`,
    );
    directionLines.push(`注意: ${structure.initiatorName}の知識の範囲内でのみ${ctx.characterName}について言及すること`);
  }

  sections.push(`【話題と会話の方向】\n${directionLines.join("\n")}`);

  // ====================================================================
  // 【登場人物（補足情報）】— MBTI・特性等の参考情報
  // ====================================================================
  sections.push(
    `【登場人物（補足情報）】\n${formatCharacterBlock(charA)}\n\n${formatCharacterBlock(charB)}`,
  );

  // ====================================================================
  // 【会話設定】
  // ====================================================================
  const encounter = input.situation ?? "偶然鉢合わせ";
  const settingParts = [`場所: ${environment.place}（${environment.timeOfDay}`];
  if (environment.weather) settingParts[0] += `、${environment.weather}`;
  settingParts[0] += `、${encounter}）`;

  // 関係性もここに統合
  const aName = charA.name;
  const bName = charB.name;
  const relationParts = [
    `関係性: ${relationLabel(relation.type)}${relation.type === 'family' && relation.familySubType ? `（${aName}は${bName}の${relation.familySubType}）` : ''}`,
    `${aName}→${bName}: ${feelingLabel(relation.feelingAtoB.label)} / スコア=${relation.feelingAtoB.score}`,
    `${bName}→${aName}: ${feelingLabel(relation.feelingBtoA.label)} / スコア=${relation.feelingBtoA.score}`,
  ];
  const relationBlock = relationParts.join(" / ");

  const settingLines = [settingParts[0]];
  if (input.gameDate) settingLines.push(`日付: ${input.gameDate}`);
  settingLines.push(relationBlock);

  // D-3: ニックネーム注入
  if (input.nicknames?.aCallsB || input.nicknames?.bCallsA) {
    const nickLines: string[] = [];
    if (input.nicknames.aCallsB) {
      nickLines.push(`${aName}は${bName}を「${input.nicknames.aCallsB}」と呼ぶ`);
    }
    if (input.nicknames.bCallsA) {
      nickLines.push(`${bName}は${aName}を「${input.nicknames.bCallsA}」と呼ぶ`);
    }
    settingLines.push(`呼び名: ${nickLines.join(" / ")}`);
  }

  sections.push(`【会話設定】\n${settingLines.join("\n")}`);

  // ====================================================================
  // 【直近の共有スニペット】（あれば）
  // ====================================================================
  if (input.recentSnippets.length > 0) {
    const snippetLines = input.recentSnippets.map((s) => `- ${s.text}`);
    sections.push(`【直近の共有スニペット】\n${snippetLines.join("\n")}`);
  }

  // ====================================================================
  // 【前回の会話記憶】（あれば）
  // ====================================================================
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
        const aboutName = k.about === charA.id ? charA.name
          : k.about === charB.id ? charB.name
          : k.about;
        memLines.push(`  - ${aboutName}について: ${k.fact}`);
      }
    }
    sections.push(`【前回の会話記憶】\n${memLines.join("\n")}`);
  }

  // ====================================================================
  // 【生成ルール（厳守）】— プロンプト末尾で再強調（recency bias 活用）
  // ====================================================================
  const rules = [
    "- 12〜16ターンの会話を生成",
    "- 1発話は短文2〜3文程度まで可。ただし長くなりすぎないこと",
    "- 意味的に区切れる箇所では句点（。）、感嘆符（！）、疑問符（？）で文を区切ること。読点（、）だけで複数の文をつなげないこと",
    "- 上記の構造（主導権、スタンス、温度感、ターンバランス）に従うこと",
    "- 相手の直前発話を受けた返答を優先する",
    "- 関連のない新話題を唐突に導入しない",
    "- 汎用テンプレ台詞の連発は避ける",
    "- 会話の冒頭を毎回同じパターンにしないこと。「あ、〇〇じゃん」のような驚き型の挨拶だけでなく、既に隣にいる状態からの「そういえばさ」、相手の行動へのツッコミ「何読んでんの」、作業中の声かけ等、多様な始め方をすること",
  ];

  // ニックネームルール
  if (input.nicknames?.aCallsB || input.nicknames?.bCallsA) {
    rules.push("- 【呼び名】会話設定で指定された呼び名を使うこと。相手の名前をそのまま使わないこと");
  }

  // 会話タイプに応じた約束ルール
  const convType = input.conversationType ?? 'normal';
  if (convType === 'normal') {
    rules.push("- 具体的な約束・予定は作らない。その場で完結する会話にすること");
  } else if (convType === 'promise_generation') {
    rules.push("- 会話の中で自然な約束・予定を1つ含めること（例: 「今度一緒に〜しよう」）");
    rules.push("- meta.memory.unresolvedThreads に約束の内容を記述すること");
  } else if (convType === 'promise_fulfillment') {
    rules.push("- 前回の約束を遂行する/した内容にし、この会話で完結させること");
  }

  // 話題ソースに応じた追加ルール
  if (topic.source === "continuation" && input.previousMemory) {
    rules.push("- 前回の未解決の話題を自然に再開すること");
  }
  if (topic.source === "snippet") {
    rules.push("- 共有スニペットの出来事を会話のきっかけに使うこと");
  }

  // 一人称ルールを末尾で再強調
  rules.push("- 【再確認】口調ルールセクションの語尾・頻出表現を毎ターン反映すること");
  rules.push("- 【再確認】一人称は指定表記を厳守（表記揺れ禁止）。自分の名前を一人称として使わないこと");

  sections.push(`【生成ルール（厳守）】\n${rules.join("\n")}`);

  // ====================================================================
  // 【出力仕様】
  // ====================================================================
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
