import { z } from 'zod';

// === Resident の拡張で使う列挙 ===
export const MbtiEnum = z.enum([
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
]);

export const GenderEnum = z.enum([
  'male',
  'female',
  'nonbinary',
  'other'
]);

export const presetCategoryEnum = z.enum([
  'speech',
  'occupation',
  'first_person',
]);
export type PresetCategory = z.infer<typeof presetCategoryEnum>;

export const todayScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // 'YYYY-MM-DD'
  bedtime: z.string().regex(/^\d{2}:\d{2}$/),    // 'HH:mm'
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/),   // 'HH:mm'
});

export const sleepProfileSchema = z.object({
  baseBedtime: z.string().regex(/^\d{2}:\d{2}$/),
  baseWakeTime: z.string().regex(/^\d{2}:\d{2}$/),
  prepMinutes: z.number().int().min(0).max(180).default(30),
  // 毎日抽選されるスケジュール
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
    sociability: z.number().int().min(1).max(5).default(3), // 社交性
    empathy: z.number().int().min(1).max(5).default(3), // 気配り傾向
    stubbornness: z.number().int().min(1).max(5).default(3), // 頑固さ
    activity: z.number().int().min(1).max(5).default(3), // 行動力
    expressiveness: z.number().int().min(1).max(5).default(3), // 表現力
  }).partial().default({}),

  speechPreset: z.string().uuid().optional(),       // 話し方プリセット

  // プレイヤーへの信頼度（UI編集不可。後続ロジックで上げ下げ）
  // 0〜100、既定50（中立）
  trustToPlayer: z.number().int().min(0).max(100).default(50),

  gender: GenderEnum.optional(),
  age: z.number().int().min(0).max(120).optional(),

  birthday: z.string().optional(), // "MM/DD" 形式

  occupation: z.string().uuid().optional(),

  firstPerson: z.string().uuid().optional(),

  interests: z.array(z.string()).max(20).optional(),

  sleepProfile: sleepProfileSchema.optional(),
});

export const relationSchema = baseEntitySchema.extend({
  a_id: z.string().uuid(),
  b_id: z.string().uuid(),
  type: z.enum(['none', 'acquaintance', 'friend', 'best_friend', 'lover', 'family']),
});

export const feelingSchema = baseEntitySchema.extend({
  from_id: z.string().uuid(),
  to_id: z.string().uuid(),
  label: z.enum(['none', 'dislike', 'maybe_dislike', 'curious', 'maybe_like', 'like', 'love', 'awkward']),
  score: z.number().int().default(0),
});

export const nicknameSchema = baseEntitySchema.extend({
  from_id: z.string().uuid(),
  to_id: z.string().uuid(),
  nickname: z.string().min(1).max(50),
});

export const eventSchema = baseEntitySchema.extend({
  kind: z.string(),
  payload: z.record(z.any()),
});

export const presetSchema = baseEntitySchema.extend({
  category: presetCategoryEnum,
  label: z.string().min(1),
  description: z.string().nullable().optional(),
  example: z.string().nullable().optional(),
  isManaged: z.boolean().default(false),
});

export const syncPayloadSchema = z.object({
  table: z.enum(['residents', 'relations', 'feelings', 'events', 'presets', 'nicknames', 'consult_answers']),
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
export type Nickname = z.infer<typeof nicknameSchema>;
export type EventLog = z.infer<typeof eventSchema>;
export type SyncPayload = z.infer<typeof syncPayloadSchema>;
export type Preset = z.infer<typeof presetSchema>;
export * from './conversation';
export * from './base';

export type RelationType = z.infer<typeof relationSchema>['type'];
export type FeelingLabel = z.infer<typeof feelingSchema>['label'];

/**
 * 住人フォームで使う、一時的な関係データ（Relation_Sim の tempRelations 相当）
 */
export type TempRelationData = {
  // relations テーブル
  relationType: RelationType;
  // feelings テーブル
  feelingLabelTo: FeelingLabel;
  feelingScoreTo: number;
  feelingLabelFrom: FeelingLabel;
  feelingScoreFrom: number;
  // nicknames テーブル
  nicknameTo: string;   // 自分が相手を呼ぶ
  nicknameFrom: string; // 相手が自分を呼ぶ
};

// === 5. （任意）リレーションを含む型定義 ===
// (※これは Drizzle `inferSelect` 版のものを Zod 版に書き換えたものです)
export type ResidentWithRelations = Resident & {
  relations: Relation[];
  feelingsFrom: Feeling[];
  feelingsTo: Feeling[];
  nicknamesFrom: Nickname[];
  nicknamesTo: Nickname[];
};
