// packages/shared/logic/conversation-validator.ts
// 会話出力の事後検証（ルールベース＋ヒューリスティクス）

import type {
  ConversationStructure,
  ConversationOutput,
  EmotionalStance,
} from "@repo/shared/types/conversation-generation";

// ---------------------------------------------------------------------------
// 検証結果
// ---------------------------------------------------------------------------

export type ValidationViolation = {
  rule: string;
  message: string;
  severity: "error" | "warning";
};

export type ValidationResult = {
  valid: boolean;
  violations: ValidationViolation[];
};

// ---------------------------------------------------------------------------
// 検証入力
// ---------------------------------------------------------------------------

export type ValidationInput = {
  output: ConversationOutput;
  structure: ConversationStructure;
  /** 各キャラの一人称。{ [characterId]: "私" } 形式 */
  firstPersonMap: Record<string, string>;
};

// ---------------------------------------------------------------------------
// 一人称の表記揺れパターン
// ---------------------------------------------------------------------------

/** 一人称に対する表記揺れのバリエーション */
const FIRST_PERSON_VARIANTS: Record<string, string[]> = {
  "私": ["わたし", "ワタシ", "あたし", "アタシ", "わたくし"],
  "わたし": ["私", "ワタシ", "アタシ"],
  "俺": ["おれ", "オレ"],
  "おれ": ["俺", "オレ"],
  "僕": ["ぼく", "ボク"],
  "ぼく": ["僕", "ボク"],
  "あたし": ["アタシ", "私", "わたし", "ワタシ"],
  "ウチ": ["うち"],
  "うち": ["ウチ"],
  "自分": ["じぶん", "ジブン"],
  "わし": ["ワシ", "儂"],
  "あたい": ["アタイ"],
  "オレ": ["俺", "おれ"],
  "ボク": ["僕", "ぼく"],
};

// ---------------------------------------------------------------------------
// ルールベース検証
// ---------------------------------------------------------------------------

function validateInitiator(
  output: ConversationOutput,
  structure: ConversationStructure,
): ValidationViolation | null {
  if (output.lines.length === 0) return null;
  if (output.lines[0].speaker !== structure.initiatorId) {
    return {
      rule: "initiator_first",
      message: `最初の発話者は主導者(${structure.initiatorName})であるべきですが、${output.lines[0].speaker}が発話しています`,
      severity: "error",
    };
  }
  return null;
}

function validateTurnCount(
  output: ConversationOutput,
): ValidationViolation | null {
  const count = output.lines.length;
  if (count < 6 || count > 8) {
    return {
      rule: "turn_count",
      message: `発話数は6〜8であるべきですが、${count}発話です`,
      severity: count < 4 || count > 10 ? "error" : "warning",
    };
  }
  return null;
}

function validateFirstPerson(
  output: ConversationOutput,
  firstPersonMap: Record<string, string>,
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  for (const line of output.lines) {
    const expected = firstPersonMap[line.speaker];
    if (!expected) continue;

    // 禁止パターン: 設定された一人称の表記揺れ
    const variants = FIRST_PERSON_VARIANTS[expected] ?? [];
    for (const variant of variants) {
      if (line.text.includes(variant)) {
        violations.push({
          rule: "first_person",
          message: `${line.speaker}の発話に表記揺れ「${variant}」が含まれています。正しくは「${expected}」です: "${line.text}"`,
          severity: "error",
        });
      }
    }
  }

  return violations;
}

function validateParticipants(
  output: ConversationOutput,
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const validSpeakers = new Set(output.participants);

  for (const line of output.lines) {
    if (!validSpeakers.has(line.speaker)) {
      violations.push({
        rule: "invalid_speaker",
        message: `未知のspeaker "${line.speaker}" が発話しています`,
        severity: "error",
      });
    }
  }

  return violations;
}

function validateMemory(
  output: ConversationOutput,
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const mem = output.meta.memory;

  if (!mem.summary || mem.summary.trim().length === 0) {
    violations.push({
      rule: "memory_summary",
      message: "memory.summaryが空です",
      severity: "error",
    });
  }

  if (!mem.topicsCovered || mem.topicsCovered.length === 0) {
    violations.push({
      rule: "memory_topics",
      message: "memory.topicsCoveredが空です",
      severity: "warning",
    });
  }

  return violations;
}

// ---------------------------------------------------------------------------
// 句読点検証
// ---------------------------------------------------------------------------

function validatePunctuation(
  output: ConversationOutput,
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  for (const line of output.lines) {
    const text = line.text;
    // 句点・感嘆符・疑問符で区切られているかチェック
    const commaCount = (text.match(/、/g) ?? []).length;
    const hasSentenceEnd = /[。！？!?]/.test(text);

    // 読点が3個以上あるのに文末句読点が一つもない → 読点で無理につなげている可能性
    if (commaCount >= 3 && !hasSentenceEnd) {
      violations.push({
        rule: "punctuation_comma_chain",
        message: `発話に読点が${commaCount}個ありますが句点・感嘆符・疑問符がありません。文を適切に区切ってください: "${text}"`,
        severity: "warning",
      });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// ヒューリスティクス検証（口調非依存）
// ---------------------------------------------------------------------------

function heuristicCheckStance(
  output: ConversationOutput,
  structure: ConversationStructure,
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];

  // キャラごとの発話を集計
  const linesByChar: Record<string, string[]> = {};
  for (const line of output.lines) {
    if (!linesByChar[line.speaker]) linesByChar[line.speaker] = [];
    linesByChar[line.speaker].push(line.text);
  }

  // 平均文字数の算出
  function avgLength(texts: string[]): number {
    if (texts.length === 0) return 0;
    const total = texts.reduce((sum, t) => sum + t.length, 0);
    return total / texts.length;
  }

  // 質問数(?)の算出
  function questionCount(texts: string[]): number {
    return texts.filter((t) => t.includes("？") || t.includes("?")).length;
  }

  const checks: Array<{
    charId: string;
    charName: string;
    stance: EmotionalStance;
  }> = [
    { charId: structure.initiatorId, charName: structure.initiatorName, stance: structure.initiatorStance },
    { charId: structure.responderId, charName: structure.responderName, stance: structure.responderStance },
  ];

  for (const { charId, charName, stance } of checks) {
    const texts = linesByChar[charId] ?? [];
    if (texts.length === 0) continue;

    const avg = avgLength(texts);
    const questions = questionCount(texts);

    switch (stance) {
      case "enthusiastic":
        // 乗り気なのに発話が極端に短い
        if (avg < 8) {
          violations.push({
            rule: "heuristic_enthusiastic_short",
            message: `${charName}はenthusiasticですが、平均文字数(${avg.toFixed(1)})が短すぎます`,
            severity: "warning",
          });
        }
        break;

      case "reluctant":
        // 面倒がっているのに発話が長い
        if (avg > 30) {
          violations.push({
            rule: "heuristic_reluctant_long",
            message: `${charName}はreluctantですが、平均文字数(${avg.toFixed(1)})が長すぎます`,
            severity: "warning",
          });
        }
        break;

      case "indifferent":
        // 興味薄なのに質問している
        if (questions > 0) {
          violations.push({
            rule: "heuristic_indifferent_question",
            message: `${charName}はindifferentですが、${questions}回質問しています`,
            severity: "warning",
          });
        }
        // 興味薄なのに発話が長い
        if (avg > 20) {
          violations.push({
            rule: "heuristic_indifferent_long",
            message: `${charName}はindifferentですが、平均文字数(${avg.toFixed(1)})が長すぎます`,
            severity: "warning",
          });
        }
        break;

      // confrontational / agreeable は量的指標だけでは判定困難 → スキップ
      default:
        break;
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// メイン検証関数
// ---------------------------------------------------------------------------

/**
 * LLM出力を検証する
 * @returns valid=false の場合、violations に違反内容を格納
 */
export function validateConversationOutput(
  input: ValidationInput,
): ValidationResult {
  const violations: ValidationViolation[] = [];

  // ルールベース検証
  const initiatorV = validateInitiator(input.output, input.structure);
  if (initiatorV) violations.push(initiatorV);

  const turnCountV = validateTurnCount(input.output);
  if (turnCountV) violations.push(turnCountV);

  violations.push(...validateFirstPerson(input.output, input.firstPersonMap));
  violations.push(...validateParticipants(input.output));
  violations.push(...validateMemory(input.output));
  violations.push(...validatePunctuation(input.output));

  // ヒューリスティクス検証
  violations.push(...heuristicCheckStance(input.output, input.structure));

  // error が1つでもあれば invalid
  const hasError = violations.some((v) => v.severity === "error");

  return {
    valid: !hasError,
    violations,
  };
}

// ---------------------------------------------------------------------------
// リトライ用のフィードバック生成
// ---------------------------------------------------------------------------

/**
 * 検証失敗時にリトライプロンプトに添える修正指示を生成
 */
export function buildRetryFeedback(result: ValidationResult): string {
  if (result.valid) return "";

  const errors = result.violations.filter((v) => v.severity === "error");
  const warnings = result.violations.filter((v) => v.severity === "warning");

  const lines: string[] = ["以下の問題を修正してください："];

  for (const e of errors) {
    lines.push(`[必須修正] ${e.message}`);
  }
  for (const w of warnings) {
    lines.push(`[推奨修正] ${w.message}`);
  }

  return lines.join("\n");
}
