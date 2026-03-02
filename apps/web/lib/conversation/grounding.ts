/**
 * @deprecated v2パイプラインでは使用しない。
 * 代替: packages/shared/logic/conversation-validator.ts (事後検証)
 * v2パイプラインが本番導入された後に削除予定。
 */
import type { ConversationBrief, HookIntent } from "@repo/shared/types/conversation";

export type GroundingAssessment = {
  ok: boolean;
  reasons: string[];
  evidence: string[];
};

const HOOK_KEYWORDS: Record<HookIntent, string[]> = {
  invite: ["一緒", "行こう", "誘", "行かない", "行きたい"],
  share: ["聞いて", "共有", "教えて", "話したい", "見て"],
  complain: ["疲れ", "しんど", "最悪", "嫌", "つらい"],
  consult: ["相談", "どう思う", "どうしたら", "アドバイス", "迷って"],
  reflect: ["振り返", "思い返", "改めて", "結局", "だったね"],
};

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function tokenizeEvidence(text: string): string[] {
  const raw = text.match(/[A-Za-z0-9\u3040-\u30ff\u3400-\u9fff]{2,}/g) ?? [];
  const tokens = new Set<string>();
  for (const chunk of raw) {
    const normalized = chunk.trim();
    if (normalized.length >= 2) tokens.add(normalized);
    for (const part of normalized.split(/[はがをにでとものへや]+/)) {
      const piece = part.trim();
      if (piece.length >= 2) tokens.add(piece);
    }
  }
  return Array.from(tokens);
}

function containsAnyKeyword(text: string, keywords: string[]): string | null {
  for (const keyword of keywords) {
    if (keyword && text.includes(keyword)) return keyword;
  }
  return null;
}

export function assessConversationGrounding(input: {
  brief: ConversationBrief;
  lines: Array<{ speaker: string; text: string }>;
}): GroundingAssessment {
  const { brief } = input;
  if (brief.fallbackMode !== "experience") {
    return { ok: true, reasons: [], evidence: [] };
  }

  const reasons: string[] = [];
  const evidence: string[] = [];
  const mergedText = normalizeText(
    (Array.isArray(input.lines) ? input.lines.map((line) => line.text).join(" ") : ""),
  );

  if (!brief.anchorExperienceId) {
    reasons.push("anchorExperienceId がありません。");
  }

  const factTokens = tokenizeEvidence(brief.anchorFact);
  const factToken = containsAnyKeyword(mergedText, factTokens.length > 0 ? factTokens : [brief.anchorFact]);
  if (!factToken) {
    reasons.push("anchorFact の証拠語が本文にありません。");
  } else {
    evidence.push(`fact:${factToken}`);
  }

  const appraisalTokens = brief.speakerAppraisal
    .flatMap((entry) => tokenizeEvidence(entry.text))
    .filter((token) => token.length >= 2);
  const appraisalToken = containsAnyKeyword(mergedText, appraisalTokens);
  if (!appraisalToken) {
    reasons.push("appraisal の痕跡が本文にありません。");
  } else {
    evidence.push(`appraisal:${appraisalToken}`);
  }

  const intents = Array.from(new Set(brief.speakerHookIntent.map((entry) => entry.intent)));
  let matchedHook: string | null = null;
  for (const intent of intents) {
    const keywords = HOOK_KEYWORDS[intent] ?? [];
    const hit = containsAnyKeyword(mergedText, keywords);
    if (hit) {
      matchedHook = `${intent}:${hit}`;
      break;
    }
  }
  if (!matchedHook) {
    reasons.push("hookIntent に対応する会話行動がありません。");
  } else {
    evidence.push(`hook:${matchedHook}`);
  }

  return {
    ok: reasons.length === 0,
    reasons,
    evidence: evidence.slice(0, 3),
  };
}
