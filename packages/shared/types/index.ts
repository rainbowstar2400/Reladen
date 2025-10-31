import { z } from 'zod';

export const baseEntitySchema = z.object({
  id: z.string().uuid(),
  updated_at: z.string().datetime(),
  deleted: z.boolean().default(false),
  owner_id: z.string().uuid().nullable().optional(),
});

export const residentSchema = baseEntitySchema.extend({
  name: z.string().min(1),
  mbti: z.string().nullable().optional(),
  traits: z.record(z.any()).nullable().optional(),
});

export const relationSchema = baseEntitySchema.extend({
  a_id: z.string().uuid(),
  b_id: z.string().uuid(),
  type: z.enum(['none', 'friend', 'best_friend', 'lover', 'family']),
});

export const feelingSchema = baseEntitySchema.extend({
  from_id: z.string().uuid(),
  to_id: z.string().uuid(),
  label: z.enum(['none', 'dislike', 'curious', 'maybe_like', 'like', 'love', 'awkward']),
});

export const eventSchema = baseEntitySchema.extend({
  kind: z.string(),
  payload: z.record(z.any()),
});

export const syncPayloadSchema = z.object({
  table: z.enum(['residents', 'relations', 'feelings', 'events']),
  changes: z.array(z.object({
    data: z.record(z.any()),
    updated_at: z.string().datetime(),
    deleted: z.boolean().optional(),
  })),
  since: z.string().datetime().optional(),
});

export type Resident = z.infer<typeof residentSchema>;
export type Relation = z.infer<typeof relationSchema>;
export type Feeling = z.infer<typeof feelingSchema>;
export type EventLog = z.infer<typeof eventSchema>;
export type SyncPayload = z.infer<typeof syncPayloadSchema>;

// ===== Foundation placeholders for Reladen migration =====
// ここは “空の枠” です。後工程で実体を埋めます。
// （UI からは直接編集しない領域：住人/関係/感情/イベントの定義）

// 住人（MBTIや性格スライダー、話し方プリセットなどを後で追加）
export interface Resident {
  // TODO: id: string;
  // TODO: name: string;
  // TODO: mbti?: string;
  // TODO: traits?: { sociability: number; empathy: number; stubbornness: number; activity: number; expressiveness: number };
  // TODO: speechPreset?: string;  // 「ていねい」「くだけた」など
  // TODO: speechCustom?: string;  // 追加の話し方ルール
}

// 関係（双方向同値。例：A-B が「友達」なら B-A も同じ）
export interface Relation {
  // TODO: a_id: string; // 片方
  // TODO: b_id: string; // もう片方
  // TODO: label: string; // 友達/親友/恋人/家族/認知/なし...
  // TODO: updatedAt: string; // ISO（Asia/Tokyo基準）
}

// 感情（片方向。例：A→B の「好きかも」など）
export interface Feeling {
  // TODO: from_id: string; // A
  // TODO: to_id: string;   // B
  // TODO: label: string;   // なし/気になる/好きかも/嫌い/大好き/気まずい...
  // TODO: updatedAt: string;
}

// 変化やログ（会話・相談・関係変化などを1行で表現）
export type ChangeKind = '好感度' | '印象' | '関係' | '信頼度';

export interface EventLog {
  // TODO: id: string;
  // TODO: at: string; // ISO（Asia/Tokyo想定）
  // TODO: kind: 'conversation' | 'consultation' | 'system' | 'relation-change' | 'feeling-change';
  // TODO: text: string; // 表示用テキスト
  // TODO: chips?: { kind: ChangeKind; label: string }[]; // 例：{kind:'好感度', label:'A→B：↑'}
  // TODO: a?: string; // 関与キャラ（任意）
  // TODO: b?: string; // 関与キャラ（任意）
}
