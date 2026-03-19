// packages/shared/logic/nickname.ts
// ニックネーム自動生成ロジック
// 仕様: 02_キャラクター定義系.md §2.6

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

export type NicknameTendency = 'nickname' | 'bare' | 'san' | 'kun_chan' | 'hierarchy';

export type NicknameGenerationTrigger = 'initial' | 'upgrade';

export type NicknameGenerationInput = {
  trigger: NicknameGenerationTrigger;
  /** 呼ぶ側 */
  characterA: {
    id: string;
    name: string;
    gender?: string | null;
    age?: number | null;
    nicknameTendency: NicknameTendency;
  };
  /** 呼ばれる側 */
  characterB: {
    id: string;
    name: string;
    gender?: string | null;
    age?: number | null;
    nicknameTendency: NicknameTendency;
  };
  /** 新しい関係レベル */
  newRelation: string;
  /** 現在の呼び名（A→B）。再生成時に使用 */
  currentNicknameAtoB?: string | null;
  /** 現在の呼び名（B→A）。再生成時に使用 */
  currentNicknameBtoA?: string | null;
};

// ---------------------------------------------------------------------------
// 傾向プリセットの説明（LLMプロンプト用）
// ---------------------------------------------------------------------------

const TENDENCY_DESCRIPTIONS: Record<NicknameTendency, string> = {
  nickname: 'あだ名で呼ぶタイプ（名前をもじったり、特徴を取った呼び方）',
  bare: '呼び捨てにするタイプ（名前そのまま、敬称なし）',
  san: 'さん付けするタイプ（丁寧、距離感を保つ）',
  kun_chan: 'くん・ちゃん付けするタイプ（親しみを込める）',
  hierarchy: '上下関係を重視するタイプ（先輩/後輩、年上/年下で呼び方を変える）',
};

export function getTendencyDescription(tendency: NicknameTendency): string {
  return TENDENCY_DESCRIPTIONS[tendency] ?? TENDENCY_DESCRIPTIONS.san;
}

// ---------------------------------------------------------------------------
// ニックネーム生成が必要かどうかの判定
// ---------------------------------------------------------------------------

/** 関係遷移時にニックネーム生成が必要かどうか */
export function shouldGenerateNickname(
  fromRelation: string,
  toRelation: string,
): NicknameGenerationTrigger | null {
  // none → acquaintance: 初回生成
  if (fromRelation === 'none' && toRelation === 'acquaintance') {
    return 'initial';
  }
  // friend → best_friend / lover: 再生成
  if (fromRelation === 'friend' && (toRelation === 'best_friend' || toRelation === 'lover')) {
    return 'upgrade';
  }
  return null;
}
