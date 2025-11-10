import { z } from 'zod';

// === Resident の拡張で使う列挙 ===
export const MbtiEnum = z.enum([
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
]);

// ★ 変更不要: この Enum 定義は残してもOK
export const SpeechPresetEnum = z.enum([
  'polite',     // ていねい
  'casual',     // くだけた
  'blunt',      // 素っ気ない
  'soft',       // やわらかい
]);

export const GenderEnum = z.enum([
  'male',
  'female',
  'nonbinary',
  'other'
]);

// ★ 変更不要: この Enum 定義は残してもOK
export const OccupationEnum = z.enum([
  'student',
  'office',
  'engineer',
  'teacher',
  'parttimer',
  'freelancer',
  'unemployed',
  'other'
]);

// ★ 変更不要: この Enum 定義は残してもOK
export const FirstPersonEnum = z.enum([
  '私',
  '僕',
  '俺',
  'うち',
  '自分'
]);

export const ActivityTendencyEnum = z.enum([
  'morning',    // 朝型
  'normal',     // 普通
  'night'       // 夜型
]);

export const sleepProfileSchema = z.object({
  // 'HH:mm'（24時間表記）。『24:00』は不可、'00:00'に正規化方針
  bedtime: z.string().regex(/^\d{2}:\d{2}$/),
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/),
  prepMinutes: z.number().int().min(0).max(180).default(30),
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
  // 保存時は未指定でも zod.parse 時に既定値が入りやすいよう .default を付けています
  traits: z.object({
    sociability: z.number().int().min(1).max(5).default(3), // 社交性
    empathy: z.number().int().min(1).max(5).default(3), // 気配り傾向
    stubbornness: z.number().int().min(1).max(5).default(3), // 頑固さ
    activity: z.number().int().min(1).max(5).default(3), // 行動力
    expressiveness: z.number().int().min(1).max(5).default(3), // 表現力
  }).partial().default({}),

  // ★ 変更: SpeechPresetEnum.optional() から z.string().optional() へ
  speechPreset: z.string().optional(),       // 話し方プリセット

  // プレイヤーへの信頼度（UI編集不可。後続ロジックで上げ下げ）
  // 0〜100、既定50（中立）
  trustToPlayer: z.number().int().min(0).max(100).default(50),

  gender: GenderEnum.optional(),
  age: z.number().int().min(0).max(120).optional(),

  // ★ 変更: OccupationEnum.optional() から z.string().optional() へ
  occupation: z.string().optional(),

  // ★ 変更: FirstPersonEnum.optional() から z.string().optional() へ
  firstPerson: z.string().optional(),

  interests: z.array(z.string()).max(20).optional(),

  activityTendency: ActivityTendencyEnum.optional(),
  sleepProfile: sleepProfileSchema.optional(),
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