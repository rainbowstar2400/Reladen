// packages/shared/gpt/prompts/conversation-prompt.ts
import type { TopicThread, BeliefRecord } from "@repo/shared/types";

export type ConversationResidentProfile = {
  id: string;
  name?: string | null;
  mbti?: string | null;
  gender?: string | null;
  age?: number | null;
  occupation?: string | null;
  speechPreset?: string | null;
  speechExample?: string | null;
  firstPerson?: string | null;
  traits?: unknown;
  interests?: unknown;
  summary?: string | null;
};

export const systemPromptConversation = `
あなたはキャラクター同士の会話を生成するAIです。
返答は必ず「有効なJSONのみ」を出力してください。前後に説明文や補足は一切付けないでください。
返すJSONは以下のスキーマに従います：

{
  "threadId": string,                   // 現在のスレッドID
  "participants": [string, string],     // 登場人物のUUID
  "topic": string,                      // 会話トピック
  "lines": [                            // 実際のセリフ
    { "speaker": string, "text": string }
  ],
  "meta": {
    "tags": string[],                   // 会話内容を示すタグ（例：「共感」「感謝」など）
    "newKnowledge": [                   // 相手に関する新情報
      { "target": string, "key": string }
    ],
    "signals": ["continue"|"close"|"park"],
    "qualityHints": {
      "turnBalance": "balanced"|"skewed",
      "tone": string
    }
  }
}
`.trim();

function formatProfileLine(
  id: string,
  profile: ConversationResidentProfile | undefined,
  belief: BeliefRecord | undefined,
) {
  if (!profile) {
    return `- ${id}：プロフィール未登録 / Belief = ${JSON.stringify(belief ?? {})}`;
  }

  const parts: string[] = [];
  if (profile.name) parts.push(`名前: ${profile.name}`);
  if (profile.gender) parts.push(`性別: ${profile.gender}`);
  if (typeof profile.age === "number") parts.push(`年齢: ${profile.age}`);
  if (profile.mbti) parts.push(`MBTI: ${profile.mbti}`);
  if (profile.occupation) parts.push(`職業: ${profile.occupation}`);
  if (profile.firstPerson) parts.push(`一人称: ${profile.firstPerson}`);
  if (profile.speechPreset) parts.push(`話し方: ${profile.speechPreset}`);

  const profileLine = parts.length ? parts.join(" / ") : "基本プロフィール情報なし";
  const traitLine = profile.traits ? `性格・特徴: ${JSON.stringify(profile.traits)}` : "性格・特徴: 未設定";
  const interestLine = profile.interests
    ? `興味・関心: ${JSON.stringify(profile.interests)}`
    : "興味・関心: 未設定";
  const summaryLine = profile.summary ? `メモ: ${profile.summary}` : "";

  const beliefLine = `Belief = ${JSON.stringify(belief ?? {})}`;

  return [
    `- ${profile.name ?? id} (ID: ${id})`,
    `  ${profileLine}`,
    `  ${traitLine}`,
    `  ${interestLine}`,
    summaryLine ? `  ${summaryLine}` : undefined,
    `  ${beliefLine}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildUserPromptConversation(opts: {
  thread: TopicThread;
  beliefs: Record<string, BeliefRecord>;
  topicHint?: string;
  lastSummary?: string;
  residents?: Record<string, ConversationResidentProfile>;
}) {
  const { thread, beliefs, topicHint, lastSummary, residents } = opts;
  const topic = topicHint ?? thread.topic ?? "雑談";
  const [a, b] = thread.participants;

  const participantBlock = [
    formatProfileLine(a, residents?.[a], beliefs[a]),
    formatProfileLine(b, residents?.[b], beliefs[b]),
  ].join("\n");

  return `
登場人物は2人です：
${participantBlock}

最近の会話まとめ：
${lastSummary ?? "(なし)"}

次のトピック: ${topic}

上記をもとに、短い会話を生成してください。
返答は必ず上記スキーマに適合するJSONのみとします。
`.trim();
}
