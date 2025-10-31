import { z } from 'zod';

// === Resident の拡張で使う列挙 ===
export const MbtiEnum = z.enum([
  'INTJ','INTP','ENTJ','ENTP',
  'INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ',
  'ISTP','ISFP','ESTP','ESFP',
]);

export const SpeechPresetEnum = z.enum([
  'polite',     // ていねい
  'casual',     // くだけた
  'blunt',      // 素っ気ない
  'soft',       // やわらかい
]);

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
    sociability:    z.number().int().min(1).max(5).default(3), // 社交性
    empathy:        z.number().int().min(1).max(5).default(3), // 気配り傾向
    stubbornness:   z.number().int().min(1).max(5).default(3), // 頑固さ
    activity:       z.number().int().min(1).max(5).default(3), // 行動力
    expressiveness: z.number().int().min(1).max(5).default(3), // 表現力
  }).partial().default({}),
  
  speechPreset: SpeechPresetEnum.optional(),       // 話し方プリセット
  
  // プレイヤーへの信頼度（UI編集不可。後続ロジックで上げ下げ）
  // 0〜100、既定50（中立）
  trustToPlayer: z.number().int().min(0).max(100).default(50),

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
