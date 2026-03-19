// packages/shared/gpt/prompts/nickname-prompt.ts
// ニックネーム生成用プロンプトビルダー
// 仕様: 02_キャラクター定義系.md §2.6

import {
  type NicknameGenerationInput,
  getTendencyDescription,
} from "../../logic/nickname";

// ---------------------------------------------------------------------------
// プロンプト構築
// ---------------------------------------------------------------------------

export function buildNicknamePrompt(input: NicknameGenerationInput): {
  system: string;
  user: string;
} {
  const { trigger, characterA, characterB, newRelation } = input;

  const system = `あなたはキャラクター間の「呼び名」を生成するAIです。
出力は必ず以下のJSON形式のみを返してください。説明文や補足は不要です。

{
  "nicknameAtoB": "AがBを呼ぶ呼び名",
  "nicknameBtoA": "BがAを呼ぶ呼び名"
}

ルール:
- 日本語で自然な呼び名にすること
- キャラクターの性別・年齢・性格の傾向を考慮すること
- 双方向を1回で生成すること（A→BとB→Aの両方）
- 呼び名は短く簡潔に（1〜6文字程度）`;

  let user: string;

  if (trigger === 'initial') {
    // 初回生成（none → acquaintance）
    const relationLabel = '顔見知り（acquaintance）';
    user = `以下の2人が${relationLabel}になりました。それぞれの呼び方の傾向を考慮して、顔見知りレベルの呼び名を生成してください。

【A: ${characterA.name}】
${characterA.gender ? `性別: ${characterA.gender}` : ''}${characterA.age ? ` / 年齢: ${characterA.age}歳` : ''}
呼び方の傾向: ${getTendencyDescription(characterA.nicknameTendency)}

【B: ${characterB.name}】
${characterB.gender ? `性別: ${characterB.gender}` : ''}${characterB.age ? ` / 年齢: ${characterB.age}歳` : ''}
呼び方の傾向: ${getTendencyDescription(characterB.nicknameTendency)}

注意:
- Aの傾向に従ってA→Bの呼び名を決める
- Bの傾向に従ってB→Aの呼び名を決める
- 顔見知りレベルなので、まだ親密すぎない呼び方にすること`;
  } else {
    // 再生成（friend → best_friend / lover）
    const relationLabels: Record<string, string> = {
      best_friend: '親友（best_friend）',
      lover: '恋人（lover）',
    };
    const relationLabel = relationLabels[newRelation] ?? newRelation;

    user = `以下の2人の関係が${relationLabel}に変わりました。より親密な呼び名に更新してください。

【A: ${characterA.name}】
${characterA.gender ? `性別: ${characterA.gender}` : ''}${characterA.age ? ` / 年齢: ${characterA.age}歳` : ''}
呼び方の傾向: ${getTendencyDescription(characterA.nicknameTendency)}
${input.currentNicknameAtoB ? `現在のA→Bの呼び名: 「${input.currentNicknameAtoB}」` : ''}

【B: ${characterB.name}】
${characterB.gender ? `性別: ${characterB.gender}` : ''}${characterB.age ? ` / 年齢: ${characterB.age}歳` : ''}
呼び方の傾向: ${getTendencyDescription(characterB.nicknameTendency)}
${input.currentNicknameBtoA ? `現在のB→Aの呼び名: 「${input.currentNicknameBtoA}」` : ''}

注意:
- 現在の呼び名をベースに、より親密な呼び方に変化させること
- ${newRelation === 'lover' ? '恋人らしい親密さを反映すること' : '親友としての距離の近さを反映すること'}
- 傾向プリセットは参考程度。関係レベルと現在の呼び名からの自然な変化を優先`;
  }

  return { system, user };
}
