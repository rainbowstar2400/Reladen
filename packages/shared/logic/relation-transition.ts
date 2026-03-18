// packages/shared/logic/relation-transition.ts
// 関係ラベルの自動遷移判定・実行
// 仕様: 03_関係・感情系.md §3.7

import type { ImpressionBase } from "../types/conversation";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type TransitionCheckInput = {
  relationType: string;
  favorAtoB: number;
  favorBtoA: number;
  impressionAtoB: ImpressionBase;
  impressionBtoA: ImpressionBase;
  /** 告白成功率用 */
  empathyA?: number;
  empathyB?: number;
};

export type TransitionResult =
  | { type: 'none' }
  | {
      type: 'observation';
      newRelation: string;
      event: 'became_acquaintance' | 'became_friend' | 'became_best_friend';
    }
  | {
      type: 'intervention';
      trigger: 'confession' | 'breakup';
      /** 告白/別れを申し出るキャラのID方向 ('a' or 'b') */
      subjectDirection: 'a' | 'b';
    };

// ---------------------------------------------------------------------------
// 観察型遷移の確率判定
// ---------------------------------------------------------------------------

/**
 * acquaintance → friend の遷移確率
 * 条件: 平均好感度 > 20 かつ 両方の印象 ≠ maybe_dislike
 */
function checkAcquaintanceToFriend(input: TransitionCheckInput): boolean {
  const avgFavor = (input.favorAtoB + input.favorBtoA) / 2;
  if (avgFavor <= 20) return false;
  if (input.impressionAtoB === 'maybe_dislike' || input.impressionBtoA === 'maybe_dislike') return false;

  const probability = Math.min(0.15, (avgFavor - 20) / 200);
  return Math.random() < probability;
}

/**
 * friend → best_friend の遷移確率
 * 条件: 双方の印象が maybe_like かつ平均好感度 ≥ 60
 */
function checkFriendToBestFriend(input: TransitionCheckInput): boolean {
  if (input.impressionAtoB !== 'maybe_like' || input.impressionBtoA !== 'maybe_like') return false;

  const avgFavor = (input.favorAtoB + input.favorBtoA) / 2;
  if (avgFavor < 60) return false;

  const probability = Math.min(0.10, (avgFavor - 60) / 200);
  return Math.random() < probability;
}

// ---------------------------------------------------------------------------
// 介入型遷移のトリガー判定
// ---------------------------------------------------------------------------

/**
 * friend → lover（告白トリガー）
 * 条件: 片方の印象が maybe_like + 好感度 ≥ 55
 */
function checkConfessionTrigger(input: TransitionCheckInput): TransitionResult {
  // A側が告白する場合
  if (input.impressionAtoB === 'maybe_like' && input.favorAtoB >= 55) {
    return { type: 'intervention', trigger: 'confession', subjectDirection: 'a' };
  }
  // B側が告白する場合
  if (input.impressionBtoA === 'maybe_like' && input.favorBtoA >= 55) {
    return { type: 'intervention', trigger: 'confession', subjectDirection: 'b' };
  }
  return { type: 'none' };
}

/**
 * 降格トリガー（best_friend/lover → friend）
 * 条件: 印象 dislike かつ好感度 ≤ 15
 */
function checkBreakupTrigger(input: TransitionCheckInput): TransitionResult {
  if (input.impressionAtoB === 'dislike' && input.favorAtoB <= 15) {
    return { type: 'intervention', trigger: 'breakup', subjectDirection: 'a' };
  }
  if (input.impressionBtoA === 'dislike' && input.favorBtoA <= 15) {
    return { type: 'intervention', trigger: 'breakup', subjectDirection: 'b' };
  }
  return { type: 'none' };
}

// ---------------------------------------------------------------------------
// メイン判定関数
// ---------------------------------------------------------------------------

/**
 * 会話評価後に呼び出し、関係遷移が発生するかチェックする。
 * 観察型遷移は確率的に自動実行、介入型遷移はトリガーのみ返す。
 */
export function checkRelationTransition(input: TransitionCheckInput): TransitionResult {
  switch (input.relationType) {
    case 'acquaintance':
      if (checkAcquaintanceToFriend(input)) {
        return { type: 'observation', newRelation: 'friend', event: 'became_friend' };
      }
      break;

    case 'friend': {
      // best_friend チェック
      if (checkFriendToBestFriend(input)) {
        return { type: 'observation', newRelation: 'best_friend', event: 'became_best_friend' };
      }
      // lover トリガーチェック
      const confession = checkConfessionTrigger(input);
      if (confession.type !== 'none') return confession;
      break;
    }

    case 'best_friend':
    case 'lover': {
      // 降格トリガーチェック
      const breakup = checkBreakupTrigger(input);
      if (breakup.type !== 'none') return breakup;
      break;
    }

    // none → acquaintance は日次バッチで処理（会話パイプラインからは呼ばれない）
    // family は遷移なし
  }

  return { type: 'none' };
}

// ---------------------------------------------------------------------------
// 遷移実行（印象リセット）
// ---------------------------------------------------------------------------

/**
 * 遷移が確定した後の印象リセットを算出する。
 * - 昇格時（friend → best_friend）: 双方 → 'like'
 * - 降格時（best_friend/lover → friend）: 好感度ベースで通常系列の値を決定
 * - それ以外: 変更なし
 */
export function computeImpressionOnTransition(params: {
  currentRelation: string;
  newRelation: string;
  favorA: number;
  favorB: number;
  currentImpressionA: ImpressionBase;
  currentImpressionB: ImpressionBase;
}): {
  newImpressionA: ImpressionBase;
  newImpressionB: ImpressionBase;
} {
  const SPECIAL_RELATIONS = new Set(['best_friend', 'lover', 'family']);
  const wasSpecial = SPECIAL_RELATIONS.has(params.currentRelation);
  const isSpecial = SPECIAL_RELATIONS.has(params.newRelation);

  // 昇格: 通常系列 → 特別系列
  if (!wasSpecial && isSpecial) {
    return {
      newImpressionA: 'like',
      newImpressionB: 'like',
    };
  }

  // 降格: 特別系列 → 通常系列
  if (wasSpecial && !isSpecial) {
    return {
      newImpressionA: favorToNormalImpression(params.favorA),
      newImpressionB: favorToNormalImpression(params.favorB),
    };
  }

  // その他: 変更なし
  return {
    newImpressionA: params.currentImpressionA,
    newImpressionB: params.currentImpressionB,
  };
}

/** 好感度ベースで通常系列の印象を決定（仕様 03:74-81） */
function favorToNormalImpression(favor: number): ImpressionBase {
  if (favor >= 45) return 'maybe_like';
  if (favor >= 35) return 'curious';
  if (favor >= 25) return 'none';
  return 'maybe_dislike';
}

// ---------------------------------------------------------------------------
// 告白成功率
// ---------------------------------------------------------------------------

/**
 * 告白成功率の算出
 * P(成功) = favorFactor × 0.5 + impressionFactor × 0.3 + personalityFactor × 0.2
 */
export function calculateConfessionSuccessRate(params: {
  /** 告白される側の好感度 */
  targetFavor: number;
  /** 告白される側の印象（相手→告白者） */
  targetImpression: ImpressionBase;
  /** 告白される側のempathy */
  targetEmpathy: number;
}): number {
  const favorFactor = Math.max(0, (params.targetFavor - 30) / 70);

  const IMPRESSION_FACTOR: Record<string, number> = {
    maybe_like: 1.0,
    curious: 0.6,
    none: 0.3,
    maybe_dislike: 0.0,
  };
  const impressionFactor = IMPRESSION_FACTOR[params.targetImpression] ?? 0.3;

  const personalityFactor = (params.targetEmpathy - 1) / 4;

  return favorFactor * 0.5 + impressionFactor * 0.3 + personalityFactor * 0.2;
}
