// packages/shared/gpt/prompts/conversation-prompt.ts
import type {
  TopicThread,
  RelationType,
  FeelingLabel,
  ConversationBrief,
  HookIntent,
} from "@repo/shared/types";

export type ConversationResidentProfile = {
  id: string;
  name?: string | null;
  mbti?: string | null;
  gender?: string | null;
  age?: number | null;
  occupation?: string | null;
  speechPreset?: string | null;
  speechPresetDescription?: string | null;
  speechExample?: string | null;
  firstPerson?: string | null;
  traits?: unknown;
  interests?: unknown;
  summary?: string | null;
};

type PairFeeling = {
  label?: FeelingLabel | string | null;
  score?: number | null;
};

export type ConversationPairContext = {
  relationType?: RelationType | string | null;
  feelings?: {
    aToB?: PairFeeling;
    bToA?: PairFeeling;
  };
  recentLines?: Array<{ speaker: string; text: string }>;
};

const MAX_RECENT_LINES = 4;
const MAX_TEXT_CHARS = 80;

export const systemPromptConversation = `
あなたはキャラクター2人の自然な会話を生成するAIです。
出力は必ず「正しいJSONのみ」を返し、説明文や補足を付けないでください。
出力JSONは以下のスキーマに従います：

{
  "threadId": string,
  "participants": [string, string],
  "topic": string,
  "lines": [
    { "speaker": string, "text": string }
  ],
  "meta": {
    "tags": string[],
    "newKnowledge": [
      { "target": string, "key": string }
    ],
    "signals": ["continue"|"close"|"park"],
    "qualityHints": {
      "turnBalance": "balanced"|"skewed",
      "tone": string
    },
    "debug": string[],
    "anchorExperienceId": string,
    "grounded": boolean,
    "groundingEvidence": string[],
    "fallbackMode": "experience"|"continuation"|"free"
  }
}

登場人物ごとに「一人称」「話し方（プリセット名）」「話し方の説明」「話し方の例文」が渡されます。
会話は自然さを保ちつつ、各人物の口調に寄せてください。
一人称は firstPerson で渡された表記を厳密に使用し、表記揺れや別表記への変換は行わないでください。
`.trim();

function truncateText(value: string, max = MAX_TEXT_CHARS): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1))}…`;
}

function safeStringify(value: unknown, max = MAX_TEXT_CHARS): string {
  if (value == null) return "未設定";
  if (typeof value === "string") return truncateText(value, max);
  try {
    return truncateText(JSON.stringify(value), max);
  } catch {
    return "未設定";
  }
}

function relationLabel(relationType?: RelationType | string | null): string {
  switch (relationType) {
    case "acquaintance":
      return "知人";
    case "friend":
      return "友人";
    case "best_friend":
      return "親友";
    case "lover":
      return "恋人";
    case "family":
      return "家族";
    case "none":
      return "関係なし";
    case "":
    case undefined:
    case null:
      return "不明";
    default:
      return String(relationType);
  }
}

function feelingLabel(label?: FeelingLabel | string | null): string {
  switch (label) {
    case "none":
      return "なし";
    case "dislike":
      return "嫌い";
    case "maybe_dislike":
      return "嫌いかも";
    case "curious":
      return "気になる";
    case "maybe_like":
      return "好きかも";
    case "like":
      return "好き";
    case "love":
      return "愛情";
    case "awkward":
      return "気まずい";
    case "":
    case undefined:
    case null:
      return "不明";
    default:
      return String(label);
  }
}

function formatFeelingScore(score?: number | null): string {
  if (!Number.isFinite(score)) return "未設定";
  return String(Math.round(Number(score)));
}

function formatHookIntent(intent: HookIntent): string {
  switch (intent) {
    case "invite":
      return "誘う";
    case "share":
      return "共有する";
    case "complain":
      return "愚痴る";
    case "consult":
      return "相談する";
    case "reflect":
      return "振り返る";
    default:
      return intent;
  }
}

function formatProfileLine(
  id: string,
  profile: ConversationResidentProfile | undefined,
) {
  const displayName = profile?.name ?? id;
  const parts: string[] = [];
  if (profile?.gender) parts.push(`性別: ${profile.gender}`);
  if (typeof profile?.age === "number") parts.push(`年齢: ${profile.age}`);
  if (profile?.mbti) parts.push(`MBTI: ${profile.mbti}`);
  if (profile?.occupation) parts.push(`職業: ${profile.occupation}`);
  if (profile?.firstPerson) parts.push(`一人称: ${profile.firstPerson}`);

  const identityLine = parts.length > 0 ? parts.join(" / ") : "基本属性: 未設定";
  const speechPreset = profile?.speechPreset ?? "未設定";
  const speechDescription = profile?.speechPresetDescription ?? "未設定";
  const traitLine = `性格・特徴: ${safeStringify(profile?.traits)}`;
  const interestLine = `趣味・関心: ${safeStringify(profile?.interests)}`;
  const summaryLine = profile?.summary ? `要約: ${truncateText(profile.summary, 120)}` : undefined;

  return [
    `- ${displayName} (ID: ${id})`,
    `  ${identityLine}`,
    `  ${traitLine}`,
    `  ${interestLine}`,
    `  話し方: テンプレート「${speechPreset}」 / 説明: ${speechDescription}`,
    profile?.firstPerson
      ? `  一人称は「${profile.firstPerson}」を厳守すること。`
      : "  一人称: 未設定",
    profile?.speechExample
      ? `  口調の例: 「${truncateText(profile.speechExample, 120)}」`
      : "  口調の例: 未設定",
    summaryLine ? `  ${summaryLine}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatTimeOfDayJst(now: Date) {
  const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const hour = jstDate.getUTCHours();
  const month = jstDate.getUTCMonth() + 1;
  const day = jstDate.getUTCDate();

  let slot = "不明";
  if (hour >= 6 && hour < 11) slot = "朝";
  else if (hour >= 11 && hour < 16) slot = "昼";
  else if (hour >= 16 && hour < 18) slot = "夕方";
  else if (hour >= 18 && hour < 23) slot = "夜";
  else if (hour >= 23 || hour < 4) slot = "深夜";
  else if (hour >= 4 && hour < 6) slot = "明け方";

  return `${month}月${day}日の${slot}です。`;
}

function formatPairContext(opts: {
  aId: string;
  bId: string;
  residents?: Record<string, ConversationResidentProfile>;
  pairContext?: ConversationPairContext;
}) {
  const { aId, bId, residents, pairContext } = opts;
  const aName = residents?.[aId]?.name ?? aId;
  const bName = residents?.[bId]?.name ?? bId;
  const relation = relationLabel(pairContext?.relationType);

  const aToB = pairContext?.feelings?.aToB;
  const bToA = pairContext?.feelings?.bToA;

  return [
    `- 関係性: ${relation}`,
    `- ${aName}→${bName}: 感情=${feelingLabel(aToB?.label)} / スコア=${formatFeelingScore(aToB?.score)}`,
    `- ${bName}→${aName}: 感情=${feelingLabel(bToA?.label)} / スコア=${formatFeelingScore(bToA?.score)}`,
  ].join("\n");
}

function formatRecentLines(
  recentLines: ConversationPairContext["recentLines"] | undefined,
  residents?: Record<string, ConversationResidentProfile>,
) {
  if (!Array.isArray(recentLines) || recentLines.length === 0) return "(なし)";
  return recentLines
    .filter(
      (line): line is { speaker: string; text: string } =>
        !!line &&
        typeof line.speaker === "string" &&
        typeof line.text === "string" &&
        line.text.trim().length > 0,
    )
    .slice(-MAX_RECENT_LINES)
    .map((line) => {
      const speakerName = residents?.[line.speaker]?.name ?? line.speaker;
      return `- ${speakerName}: ${truncateText(line.text, 120)}`;
    })
    .join("\n") || "(なし)";
}

function formatBriefBlock(
  brief: ConversationBrief,
  residents?: Record<string, ConversationResidentProfile>,
) {
  const appraisalLines = brief.speakerAppraisal.length
    ? brief.speakerAppraisal.map((entry) => {
      const speakerName = residents?.[entry.speakerId]?.name ?? entry.speakerId;
      return `- ${speakerName}: ${truncateText(entry.text, 120)}`;
    }).join("\n")
    : "- (なし)";

  const hookLines = brief.speakerHookIntent.length
    ? brief.speakerHookIntent.map((entry) => {
      const speakerName = residents?.[entry.speakerId]?.name ?? entry.speakerId;
      return `- ${speakerName}: ${formatHookIntent(entry.intent)} (${entry.intent})`;
    }).join("\n")
    : "- (なし)";

  return [
    `- fallbackMode: ${brief.fallbackMode}`,
    `- expressionStyle: ${brief.expressionStyle}`,
    `- anchorExperienceId: ${brief.anchorExperienceId ?? "(none)"}`,
    `- anchorSignature: ${brief.anchorSignature ?? "(none)"}`,
    `- anchorFact: ${brief.anchorFact}`,
    "- speakerAppraisal:",
    appraisalLines,
    "- speakerHookIntent:",
    hookLines,
  ].join("\n");
}

export function buildUserPromptConversation(opts: {
  thread: TopicThread;
  brief: ConversationBrief;
  topicHint?: string;
  lastSummary?: string;
  residents?: Record<string, ConversationResidentProfile>;
  pairContext?: ConversationPairContext;
}) {
  const { thread, brief, topicHint, lastSummary, residents, pairContext } = opts;
  const topic = topicHint ?? thread.topic ?? "雑談";
  const [a, b] = thread.participants;
  const timeContext = formatTimeOfDayJst(new Date());

  const participantBlock = [
    formatProfileLine(a, residents?.[a]),
    formatProfileLine(b, residents?.[b]),
  ].join("\n");

  const relationBlock = formatPairContext({
    aId: a,
    bId: b,
    residents,
    pairContext,
  });
  const recentLinesBlock = formatRecentLines(pairContext?.recentLines, residents);
  const briefBlock = formatBriefBlock(brief, residents);

  return `
【登場人物プロフィール】
${participantBlock}

【2人の関係性と現在の感情】
${relationBlock}

【直近の会話抜粋（最大4発話）】
${recentLinesBlock}

【現在時刻】
${timeContext}

【最近の会話まとめ】
${lastSummary ?? "(なし)"}

【今回の話題】
${topic}

【ConversationBrief（最優先入力）】
${briefBlock}

【会話生成ルール】
- fallbackMode が experience の場合、anchorFact の具体語を最低1つ本文に入れる
- fallbackMode が experience の場合、少なくとも1人の appraisal を自然に反映する
- fallbackMode が experience の場合、hookIntent に対応する会話行動（誘う/共有/愚痴/相談/振り返り）を1つ入れる
- 同一会話内では主題を原則1つに保つ
- 最近の会話まとめに主題がある場合は、その主題を優先して継続する
- 話題を切り替える場合は橋渡し表現（例: そういえば / ところで / その話で言うと / 関連して）を必ず入れる
- 話題を切り替えた場合のみ meta.tags に "topic_shift" を含める
- 発話数は6〜8発話にする
- 1発話は1文を基本にする
- 相手の直前発話を受けた返答を優先する
- 話し方（テンプレート名・説明・例文）を口調に反映する
- 一人称はプロフィールで指定された表記を厳守する（表記揺れ禁止）
- 関連のない新話題を唐突に導入しない
- 汎用テンプレ台詞の連発は避ける

【meta の設定ルール】
- meta.anchorExperienceId は brief.anchorExperienceId をそのまま設定する（無ければ空文字）
- meta.anchorSignature は brief.anchorSignature を設定する（無ければ空文字）
- meta.fallbackMode は brief.fallbackMode を設定する
- meta.grounded は本文が brief に接地していれば true、そうでなければ false
- meta.groundingEvidence には anchorFact と appraisal の証拠語を短文で入れる（最大3件）

【出力仕様】
- 出力は必ず上記スキーマに厳密一致するJSONのみ
- participants は指定された2名IDをそのまま使う
- lines[].speaker は必ず participants のどちらかにする
`.trim();
}
