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
  speechPresetDescription?: string | null;
  speechExample?: string | null;
  firstPerson?: string | null;
  traits?: unknown;
  interests?: unknown;
  summary?: string | null;
};

export const systemPromptConversation = `
あなたはキャラクター間の会話を生成するAIです。
出力は必ず「正しいJSONのみ」を出力してください。前後に説明文や補足は一切付けないでください。
出力JSONは以下のスキーマに従います：

{
  "threadId": string,                   // 現在のスレッドID
  "participants": [string, string],     // 登場人物のUUID
  "topic": string,                      // 会話トピック
  "lines": [                            // 会話のセリフ
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
このデータに紐づく登場人物には「一人称」「話し方（プリセット名）」「話し方の説明」「話し方の例文」が設定されています。
それぞれの登場人物は常にプロフィールで指定された一人称のみを使い、会話途中で他の一人称へ変えないでください。
セリフの文体や雰囲気は「話し方（プリセット名）」「話し方の説明」「話し方の例文」を参考にし、
完全一致でなくてもよいのでなるべく近い口調にしてください。
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

  const profileLine = parts.length ? parts.join(" / ") : "（プロフィールなし）";
  const traitLine = profile.traits ? `性格・特徴: ${JSON.stringify(profile.traits)}` : "性格・特徴: 未設定";
  const interestLine = profile.interests ? `趣味・関心: ${JSON.stringify(profile.interests)}` : "趣味・関心: 未設定";
  const summaryLine = profile.summary ? `要約: ${profile.summary}` : "";

  // 一人称・話し方まわり
  const firstPerson = profile.firstPerson; // 「未設定」を一人称としては渡さない
  const speechPresetLine = profile.speechPreset ?? "未設定";
  const speechPresetDescriptionLine = profile.speechPresetDescription ?? "未設定";

  const beliefLine = `Belief = ${JSON.stringify(belief ?? {})}`;

  return [
    `- ${profile.name ?? id} (ID: ${id})`,
    `  ${profileLine}`,
    `  ${traitLine}`,
    `  ${interestLine}`,
    "  会話スタイル:",
    // 一人称
    firstPerson
      ? `    - 一人称: 「${firstPerson}」`
      : "    - 一人称: （未設定）",
    firstPerson
      ? "      セリフ中で自分を指すときは、必ずこの一人称だけを使うこと。"
      : undefined,
    firstPerson
      ? "      表記（漢字・ひらがな・カタカナなど）や単語の形を一切変えないこと。"
      : undefined,
    // 話し方
    `    - 話し方: ${speechPresetLine}`,
    `    - 話し方の説明: ${speechPresetDescriptionLine}`,
    // 例文（ある場合だけ）
    profile.speechExample ? `    - 話し方の例: 「${profile.speechExample}」` : undefined,
    profile.speechExample
      ? "      セリフの文体や語尾は、この例文と上の説明を真似するようにしてください。"
      : undefined,
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

会話スタイルの共通ルール：
- プロフィールに書かれた一人称のみを使い、途中で変えないこと
- 話し方（プリセット名）・説明・例文は口調の参考にすること

最近の会話まとめ：
${lastSummary ?? "(なし)"}

次のトピック: ${topic}

これらを踏まえて、短い会話を生成してください。
出力は必ず上記スキーマに合致したJSONのみとします。
`.trim();
}
