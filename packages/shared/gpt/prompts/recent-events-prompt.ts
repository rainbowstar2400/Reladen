// packages/shared/gpt/prompts/recent-events-prompt.ts
// キャラクター「最近の出来事」バッチ生成用プロンプト
//
// 全キャラのプロフィールを入力し、1回のLLM呼び出しで全キャラ分の
// 「最近ありそうな出来事」を生成する。トークン効率重視。

export type RecentEventsCharacterInput = {
  id: string;
  name: string;
  occupation?: string | null;
  interests: string[];
  /** 性格の簡易記述（formatTraitDescriptionsの出力等） */
  personalityNote?: string;
};

export const systemPromptRecentEvents = `
あなたはキャラクターの日常を想像して「最近の出来事」を生成するAIです。
出力は必ず「正しいJSONのみ」を返し、説明文は付けないでください。

出力JSONスキーマ:
{
  "events": [
    {
      "characterId": string,
      "fact": string
    }
  ]
}

ルール:
- 各キャラクターにつき0〜1件の出来事を生成
- 出来事は日常的で小さなもの（大事件や劇的な出来事は避ける）
- キャラクターの職業・興味・性格に合った出来事にする
- factは短く（20文字以内目安）、第三者が噂として伝えられる内容にする
- 全員に出来事を作る必要はない（0件でもよい）
`.trim();

export function buildRecentEventsUserPrompt(
  characters: RecentEventsCharacterInput[],
): string {
  const charLines = characters.map((c) => {
    const parts = [`- ${c.name} (ID: ${c.id})`];
    if (c.occupation) parts.push(`  職業: ${c.occupation}`);
    if (c.interests.length > 0) parts.push(`  興味: ${c.interests.join(", ")}`);
    if (c.personalityNote) parts.push(`  性格: ${c.personalityNote}`);
    return parts.join("\n");
  });

  return `
【キャラクター一覧】
${charLines.join("\n\n")}

上記のキャラクターたちの「最近の出来事」を生成してください。
各キャラにつき0〜1件、日常的な小さな出来事を想像してください。
`.trim();
}

/**
 * GPT JSON Schema（structured output用）
 */
export const recentEventsResponseSchema = {
  name: "recent_events_batch",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            characterId: { type: "string" },
            fact: { type: "string" },
          },
          required: ["characterId", "fact"],
        },
      },
    },
    required: ["events"],
  },
  strict: true,
} as const;
