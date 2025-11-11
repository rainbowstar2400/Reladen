import { z } from 'zod';

// === Resident の拡張で使う列挙 ===
export const MbtiEnum = z.enum([
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
]);

// ★ 削除: SpeechPresetEnum
// ★ 削除: OccupationEnum
// ★ 削除: FirstPersonEnum

export const GenderEnum = z.enum([
  'male',
  'female',
  'nonbinary',
  'other'
]);

// ★ 変更: sleepProfileSchema を新しい定義に
export const todayScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // 'YYYY-MM-DD'
  bedtime: z.string().regex(/^\d{2}:\d{2}$/),    // 'HH:mm'
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/),   // 'HH:mm'
});

export const sleepProfileSchema = z.object({
  // (変更) 基準時刻
  baseBedtime: z.string().regex(/^\d{2}:\d{2}$/),
  baseWakeTime: z.string().regex(/^\d{2}:\d{2}$/),
  
  prepMinutes: z.number().int().min(0).max(180).default(30),
  
  // (追加) 毎日抽選されるスケジュール
  todaySchedule: todayScheduleSchema.optional(),
});

export const baseEntitySchema = z.object({
  id: z.string().uuid(),
  updated_at: z.string().datetime(),
  deleted: z.boolean().default(false),
  owner_id: z.string().uuid().nullable().optional(),
});

export const residentSchema = baseEntitySchema.extend({
  name: z.string().min(1),
  mbti: MbtiEnum.optional(),

  // 5つの性格スライダーは 1〜5（未設定はデフォルト3）
  traits: z.object({
    sociability:    z.number().int().min(1).max(5).default(3), // 社交性
    empathy:        z.number().int().min(1).max(5).default(3), // 気配り傾向
    stubbornness:   z.number().int().min(1).max(5).default(3), // 頑固さ
    activity:       z.number().int().min(1).max(5).default(3), // 行動力
    expressiveness: z.number().int().min(1).max(5).default(3), // 表現力
  }).partial().default({}),
  
  // ★ 変更: string().uuid() に変更 (presets.id を参照)
  speechPreset: z.string().uuid().optional(),       // 話し方プリセット
  
  // プレイヤーへの信頼度（UI編集不可。後続ロジックで上げ下げ）
  // 0〜100、既定50（中立）
  trustToPlayer: z.number().int().min(0).max(100).default(50),

  gender: GenderEnum.optional(),
  age: z.number().int().min(0).max(120).optional(),
  
  // ★ 変更: string().uuid() に変更 (presets.id を参照)
  occupation: z.string().uuid().optional(),
  
  // ★ 変更: string().uuid() に変更 (presets.id を参照)
  firstPerson: z.string().uuid().optional(),
  
  interests: z.array(z.string()).max(20).optional(),

  sleepProfile: sleepProfileSchema.optional(),
});

export const relationSchema = baseEntitySchema.extend({
  a_id: z.string().uuid(),
  b_id: z.string().uuid(),
  type: z.enum(['none', 'friend', 'best_friend', 'lover', 'family']),
});

// ... (feelingSchema, eventSchema, syncPayloadSchema は変更なし) ...
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
  table: z.enum(['residents', 'relations', 'feelings', 'events', 'consult_answers']),
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
export * from './conversation';
export * from './base';