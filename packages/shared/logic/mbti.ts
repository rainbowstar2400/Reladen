// packages/shared/logic/mbti.ts
// Relation_Sim の client/src/lib/mbti.js を TypeScript/Reladen 向けに等価移植
// - 質問セット：回答スコア(1~5)を四軸(E-I, S-N, T-F, J-P)にマッピング
// - 集計→各軸の正負でタイプを決定
// - 必要なら質問文は後から差し替え可能

export type MbtiAxis = 'EI' | 'SN' | 'TF' | 'JP';
export type MbtiType =
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';

export type Question = {
  id: string;
  text: string;
  axis: MbtiAxis;        // どの軸に寄与するか
  direction: 1 | -1;     // 同じ軸の中で+方向(E/S/T/J)に寄与=+1、逆方向(I/N/F/P)に寄与=-1
};

export type Answer = {
  id: string;            // question.id
  score: number;         // 1..5 (3を中立、4/5を賛成寄り、1/2を反対寄り)
};

// --- 質問セット（Relation_Sim と同枠のサンプル。必要なら文言だけ後から置き換えてOK） ---
export const QUESTIONS: Question[] = [
  // EI
  { id: 'q_ei_1', text: '初対面の人との会話は苦にならない', axis: 'EI', direction: +1 },
  { id: 'q_ei_2', text: '充電は人と一緒より一人の時間で行うことが多い', axis: 'EI', direction: -1 },
  // SN
  { id: 'q_sn_1', text: '抽象的な話より具体例の方が得意だ', axis: 'SN', direction: +1 },
  { id: 'q_sn_2', text: 'ひらめきや連想から考えを広げるのが好きだ', axis: 'SN', direction: -1 },
  // TF
  { id: 'q_tf_1', text: '判断は筋道・一貫性を重視する', axis: 'TF', direction: +1 },
  { id: 'q_tf_2', text: '人の感情面を優先して判断しがちだ', axis: 'TF', direction: -1 },
  // JP
  { id: 'q_jp_1', text: '計画を立てて順序立てて進めたい', axis: 'JP', direction: +1 },
  { id: 'q_jp_2', text: '流れに合わせて柔軟に対応したい', axis: 'JP', direction: -1 },
];

// --- スコア変換: 1..5 を -2..+2 に正規化（3を0） ---
function scoreToDelta(score: number): number {
  const s = Math.max(1, Math.min(5, Math.round(score)));
  return s - 3; // 1->-2, 2->-1, 3->0, 4->+1, 5->+2
}

// --- 回答から四軸合計を算出 ---
export function accumulateAxes(answers: Answer[]) {
  const sum = { EI: 0, SN: 0, TF: 0, JP: 0 } as Record<MbtiAxis, number>;
  const qmap = new Map(QUESTIONS.map(q => [q.id, q]));
  for (const a of answers) {
    const q = qmap.get(a.id);
    if (!q) continue;
    const delta = scoreToDelta(a.score) * q.direction;
    sum[q.axis] += delta;
  }
  return sum;
}

// --- 四軸合計からタイプ文字列を決定 ---
export function decideMbti(sum: Record<MbtiAxis, number>): MbtiType {
  const e_or_i = sum.EI >= 0 ? 'E' : 'I';
  const s_or_n = sum.SN >= 0 ? 'S' : 'N';
  const t_or_f = sum.TF >= 0 ? 'T' : 'F';
  const j_or_p = sum.JP >= 0 ? 'J' : 'P';
  const mbti = (e_or_i + s_or_n + t_or_f + j_or_p) as MbtiType;
  return mbti;
}

// --- まとめ関数: 回答→タイプ ---
export function calculateMbti(answers: Answer[]): MbtiType {
  const sum = accumulateAxes(answers);
  return decideMbti(sum);
}
