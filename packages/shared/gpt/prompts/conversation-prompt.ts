// packages/shared/gpt/prompts/conversation-prompt.ts
import type { TopicThread, BeliefRecord } from "@repo/shared/types";

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

export function buildUserPromptConversation(opts: {
  thread: TopicThread;
  beliefs: Record<string, BeliefRecord>;
  topicHint?: string;
  lastSummary?: string;
}) {
  const { thread, beliefs, topicHint, lastSummary } = opts;
  const topic = topicHint ?? thread.topic ?? "雑談";

  return `
登場人物は2人です：
- ${thread.participants[0]}：Belief = ${JSON.stringify(beliefs[thread.participants[0]] ?? {})}
- ${thread.participants[1]}：Belief = ${JSON.stringify(beliefs[thread.participants[1]] ?? {})}

最近の会話まとめ：
${lastSummary ?? "(なし)"}

次のトピック: ${topic}

上記をもとに、短い会話を生成してください。
返答は必ず上記スキーマに適合するJSONのみとします。
`.trim();
}
