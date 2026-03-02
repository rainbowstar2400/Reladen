// packages/shared/gpt/prompts/trait-descriptions.ts
// 性格特性の行動翻訳マップ + MBTI性格傾向マップ

import type { TraitKey, TraitTier } from "@repo/shared/types/conversation-generation";

// ---------------------------------------------------------------------------
// 特性 → 行動記述マップ
// ---------------------------------------------------------------------------

export type TraitBehaviorEntry = {
  label: string;
  low: string;
  neutral: string;
  high: string;
};

export const TRAIT_BEHAVIOR_MAP: Record<TraitKey, TraitBehaviorEntry> = {
  sociability: {
    label: "社交性",
    low: "会話は短く済ませたがり、沈黙を嫌がらない。自分から話を広げることは少ない",
    neutral: "適度に相槌を打ち、聞かれれば答えるが積極的に話題を振るほどではない",
    high: "自分から話題を振り、相手の話に積極的にリアクションする。沈黙が続くと自ら埋めようとする",
  },
  empathy: {
    label: "気配り",
    low: "自分の考えを優先し、相手の気持ちへの言及が少ない。率直にものを言う",
    neutral: "相手への配慮はするが、過度に気を遣わない",
    high: "相手の気持ちを察して先回りした言葉を選ぶ。相手が言いにくそうなことを代弁したり、フォローを入れる",
  },
  stubbornness: {
    label: "頑固さ",
    low: "相手の意見にすぐ同調し、自分の意見を押し通さない。「そうだね」「確かに」が多い",
    neutral: "自分の意見は持っているが、強く主張しない",
    high: "自分の意見を簡単に変えず、反論されても理由を述べて返す。「でも」「いや」から入ることがある",
  },
  activity: {
    label: "行動力",
    low: "新しいことへの提案をせず、現状維持を好む。「まあいいか」「面倒だな」のような反応",
    neutral: "誘われれば乗るが、自分からは積極的に動かない",
    high: "「やってみよう」「行ってみない？」のように行動を提案する。計画を立てたがる",
  },
  expressiveness: {
    label: "表現力",
    low: "感情表現が控えめで、淡々と事実を述べる。感嘆詞や強調表現が少ない",
    neutral: "状況に応じて感情を見せるが、大げさにはならない",
    high: "感情を豊かに表現する。驚き・喜び・不満をストレートに言葉にする。感嘆詞や擬音語を使う",
  },
};

// ---------------------------------------------------------------------------
// 数値 → 段階変換
// ---------------------------------------------------------------------------

export function traitTier(value: number): TraitTier {
  if (value <= 2) return "low";
  if (value >= 4) return "high";
  return "neutral";
}

// ---------------------------------------------------------------------------
// 特性をプロンプト用の行動記述文字列に変換
// neutral(3) は省略してトークン節約
// ---------------------------------------------------------------------------

export function formatTraitDescriptions(
  traits: Partial<Record<TraitKey, number>> | null | undefined,
): string {
  if (!traits || typeof traits !== "object") {
    return "行動特性: 特筆すべき偏りなし（平均的）";
  }

  const lines: string[] = [];

  for (const [key, entry] of Object.entries(TRAIT_BEHAVIOR_MAP)) {
    const value = typeof traits[key as TraitKey] === "number"
      ? traits[key as TraitKey]!
      : 3;
    const tier = traitTier(value);
    if (tier !== "neutral") {
      lines.push(`${entry.label}(${value}/5): ${entry[tier]}`);
    }
  }

  if (lines.length === 0) {
    return "行動特性: 特筆すべき偏りなし（平均的）";
  }
  return `行動特性:\n${lines.map((l) => `    - ${l}`).join("\n")}`;
}

// ---------------------------------------------------------------------------
// MBTI → 性格傾向（認知スタイル）マップ
// MBTIは「何を考えるか」に影響、5特性は「どう表に出すか」に影響
// ---------------------------------------------------------------------------

export const MBTI_DESCRIPTIONS: Record<string, string> = {
  INTJ: "戦略的思考。物事を体系的に分析し、長期的な計画を好む",
  INTP: "論理的探求。理論やアイデアの分析を好み、知的好奇心が強い",
  ENTJ: "指導的思考。効率を重視し、目標に向かって他者を導こうとする",
  ENTP: "発想豊か。議論や新しいアイデアを楽しみ、既存の枠に挑戦する",
  INFJ: "直感的洞察。他者の内面を深く理解し、理想を持って行動する",
  INFP: "内省的で理想主義。自分の価値観を大切にし、共感力が高い",
  ENFJ: "共感的リーダー。他者の成長を支援し、調和を重視する",
  ENFP: "好奇心旺盛。可能性を追求し、人との繋がりを楽しむ。話題が跳躍しやすい",
  ISTJ: "堅実で秩序重視。事実に基づいて判断し、責任感が強い",
  ISFJ: "献身的で温かい。伝統や習慣を大切にし、他者を支えることに喜びを感じる",
  ESTJ: "組織的で実行力がある。ルールを守り、効率的に物事を進める",
  ESFJ: "社交的で協調性が高い。周囲の調和を保ち、他者の気持ちに敏感",
  ISTP: "実践的で冷静。必要なことだけ話し、手を動かして問題を解決する",
  ISFP: "穏やかで感受性が豊か。自分のペースを大切にし、美的感覚が鋭い",
  ESTP: "行動的で現実的。今この瞬間を楽しみ、臨機応変に対応する",
  ESFP: "明るく社交的。周囲を盛り上げ、楽しい雰囲気を作る",
};

export function formatMbtiDescription(mbti: string | null | undefined): string | undefined {
  if (!mbti) return undefined;
  const desc = MBTI_DESCRIPTIONS[mbti];
  if (!desc) return `MBTI: ${mbti}`;
  return `性格傾向(${mbti}): ${desc}`;
}
