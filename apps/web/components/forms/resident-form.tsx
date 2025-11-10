'use client';

import React from 'react';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Resident } from '@/types';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useUpsertResident } from '@/lib/data/residents';
import { useMemo, useState, useEffect } from 'react';
import { QUESTIONS, calculateMbti, type Answer } from '@/lib/mbti';
import { useRouter } from 'next/navigation';
import { defaultSleepByTendency } from '@/lib/schedule';

// === フォーム内で使う選択肢（まずは固定配列で運用） ===
const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;

const SPEECH_PRESETS = [
  { value: 'polite', label: 'ていねい' },
  { value: 'casual', label: 'くだけた' },
  { value: 'blunt', label: '素っ気ない' },
  { value: 'soft', label: 'やわらかい' },
] as const;

// traits の初期値（未設定でも落ちないように）
const DEFAULT_TRAITS = {
  sociability: 3,    // 社交性
  empathy: 3,        // 気配り
  stubbornness: 3,   // 頑固さ
  activity: 3,       // 行動力
  expressiveness: 3, // 表現力
} as const;

const residentFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, '名前は必須です'),
  mbti: z.string().optional().nullable(),
  // JSONではなく、5項目の数値スライダー（1〜5）
  traits: z.object({
    sociability: z.number().int().min(1).max(5),
    empathy: z.number().int().min(1).max(5),
    stubbornness: z.number().int().min(1).max(5),
    activity: z.number().int().min(1).max(5),
    expressiveness: z.number().int().min(1).max(5),
  }),
  // 追加：話し方プリセット（未設定可）
  speechPreset: z.string().optional().nullable(),
  // 追加：プレイヤーへの信頼度（表示専用）
  trustToPlayer: z.number().min(0).max(100).optional(),

  // --- 背景情報 ---
  gender: z.preprocess(
    v => (v === '' || v == null ? undefined : v),
    z.enum(['male', 'female', 'nonbinary', 'other']).optional()
  ),

  occupation: z.preprocess(
    v => (v === '' || v == null ? undefined : v),
    z.enum(['student', 'office', 'engineer', 'teacher', 'parttimer', 'freelancer', 'unemployed', 'other']).optional()
  ),

  firstPerson: z.preprocess(
    v => (v === '' || v == null ? undefined : v),
    z.enum(['私', '僕', '俺', 'うち', '自分']).optional()
  ),


  age: z.preprocess(
    v => (v === '' || v == null ? undefined : Number(v)),
    z.number().int().min(0).max(120).optional()
  ),
  
  interests: z.array(z.object({ value: z.string() })).optional(),

  // --- 活動傾向・睡眠関連 ---
  activityTendency: z.preprocess(
    v => (v === '' ? undefined : v),
    z.enum(['morning', 'normal', 'night']).optional()
  ),

  sleepBedtime: z.preprocess(
    v => (v === '' ? undefined : v),
    z.string().regex(/^\d{2}:\d{2}$/).optional()
  ),
  sleepWakeTime: z.preprocess(
    v => (v === '' ? undefined : v),
    z.string().regex(/^\d{2}:\d{2}$/).optional()
  ),

});

type ResidentFormValues = z.infer<typeof residentFormSchema>;

export function ResidentForm({

  defaultValues,
  onSubmitted,
}: {
  defaultValues?: Partial<Resident>;
  onSubmitted?: () => void;
}) {
  const router = useRouter();
  const form = useForm<ResidentFormValues>({
    resolver: zodResolver(residentFormSchema),
    defaultValues: useMemo(() => {
      // traits はオブジェクトとして持つ（未設定なら既定値をセット）
      const traitsObj =
        defaultValues?.traits && typeof defaultValues.traits === 'object'
          ? (defaultValues.traits as any)
          : { ...DEFAULT_TRAITS };

      return {
        ...defaultValues, // ★ スプレッドを先頭に移動
        name: defaultValues?.name ?? '',
        mbti: defaultValues?.mbti ?? '',
        speechPreset: defaultValues?.speechPreset ?? '',
        trustToPlayer: defaultValues?.trustToPlayer ?? 50,
        traits: traitsObj,
        // ★ 最後に 'interests' を正しい型で上書き
        interests: defaultValues?.interests?.map(val => ({ value: val })) ?? [],
      };
    }, [defaultValues]),

  });

  // 診断パネルの開閉と、各設問のスコア（1〜5、初期値は中立3）
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [diagScores, setDiagScores] = useState<Record<string, number>>(
    () => Object.fromEntries(QUESTIONS.map(q => [q.id, 3]))
  );
  useEffect(() => {
    if (!showDiagnosis) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDiagnosis(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDiagnosis]);


  const answers: Answer[] = useMemo(
    () => Object.entries(diagScores).map(([id, score]) => ({ id, score })),
    [diagScores]
  );
  const onDiagScoreChange = (id: string, score: number) =>
    setDiagScores(prev => ({ ...prev, [id]: score }));

  const upsert = useUpsertResident();

  async function handleSubmit(values: ResidentFormValues) {
    // MBTI: 空文字は undefined、非空は MBTI列挙に合わせる
    const normalizedMbti: (typeof MBTI_TYPES)[number] | undefined =
      values.mbti && values.mbti.trim().length > 0
        ? (values.mbti as (typeof MBTI_TYPES)[number])
        : undefined;

    // speechPreset: 空/null は undefined、非空は union に合わせる
    const normalizedSpeech: (typeof SPEECH_PRESETS)[number]['value'] | undefined =
      typeof values.speechPreset === 'string' && values.speechPreset.trim().length > 0
        ? (values.speechPreset as (typeof SPEECH_PRESETS)[number]['value'])
        : undefined;

    const gender = values.gender as ('male' | 'female' | 'nonbinary' | 'other') | undefined;
    const occupation = values.occupation as ('student' | 'office' | 'engineer' | 'teacher' | 'parttimer' | 'freelancer' | 'unemployed' | 'other') | undefined;
    const firstPerson = values.firstPerson as ('私' | '僕' | '俺' | 'うち' | '自分') | undefined;

    // ★ { value: string }[] から string[] に変換
    const interests = values.interests?.map(item => item.value).filter(Boolean) ?? [];

    // 活動傾向
    const activityTendency = values.activityTendency as ('morning' | 'normal' | 'night') | undefined;

    const sleepProfile =
      values.sleepBedtime && values.sleepWakeTime
        ? {
          bedtime: values.sleepBedtime,
          wakeTime: values.sleepWakeTime,
          prepMinutes: 30,
        }
        : undefined;

    // ↑ 正規化済みの値だけを使って payload を明示的に組む（...values は使わない）
    const payload = {
      id: values.id,
      name: values.name,
      mbti: normalizedMbti,
      traits: values.traits,
      ...(normalizedSpeech !== undefined ? { speechPreset: normalizedSpeech } : {}),

      gender,
      age: typeof values.age === 'number' ? values.age : undefined,
      occupation,
      firstPerson,
      interests: interests.length > 0 ? interests : undefined,
      activityTendency,
      ...(sleepProfile ? { sleepProfile } : {}),
    };

    const saved = await upsert.mutateAsync(payload);

    form.reset({
      id: saved.id,
      name: saved.name,
      mbti: saved.mbti ?? '',
      traits: saved.traits ?? { sociability: 3, empathy: 3, stubbornness: 3, activity: 3, expressiveness: 3 },
      speechPreset: saved.speechPreset ?? '',
      trustToPlayer: saved.trustToPlayer ?? 50,

      // ★ 追加（saved 側に存在すれば反映）
      gender: saved.gender ?? '',
      age: typeof saved.age === 'number' ? saved.age : undefined,
      occupation: saved.occupation ?? '',
      firstPerson: saved.firstPerson ?? '',
      // ★ string[] を { value: string }[] に変換
      interests: saved.interests?.map(val => ({ value: val })) ?? [],
      activityTendency: saved.activityTendency ?? '',
      sleepBedtime: saved.sleepProfile?.bedtime ?? '',
      sleepWakeTime: saved.sleepProfile?.wakeTime ?? '',
    });


    onSubmitted?.();
  }

  // ★ 追加: 興味・関心 (useFieldArray)
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "interests",
  });

  // ★ 追加: 新しく追加する興味・関心の入力値を管理
  const [newInterest, setNewInterest] = useState('');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>名前</FormLabel>
              <FormControl>
                <Input placeholder="例：アカリ" {...field} />
              </FormControl>
              <FormMessage>{form.formState.errors.name?.message as string}</FormMessage>
            </FormItem>
          )}
        />
        {/* --- MBTI（診断 または手動で選択） --- */}
        <FormField
          control={form.control}
          name="mbti"
          render={({ field }) => {
            const v = field.value ?? '';
            return (
              <FormItem className="space-y-2">
                <FormLabel className="text-base font-semibold">
                  MBTI（診断 または手動で選択）
                </FormLabel>

                <FormControl>
                  <div className="relative w-full flex items-center">
                    {/* 左側：診断ボタン */}
                    <div className="absolute left-8">
                      <Button
                        type="button"
                        onClick={() => setShowDiagnosis(true)}
                        className="bg-black text-white hover:bg-black/90 px-5 py-2"
                      >
                        診断する
                      </Button>
                    </div>

                    {/* 中央：ラベル＋セレクト */}
                    <div className="mx-auto flex items-center gap-2">
                      <label
                        htmlFor="mbti-select"
                        className="text-sm text-gray-700 whitespace-nowrap"
                      >
                        手動で選択：
                      </label>
                      <select
                        id="mbti-select"
                        className="rounded border px-3 py-2 min-w-[140px]"
                        name={field.name}
                        ref={field.ref}
                        value={v}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                      >
                        <option value="">（未設定）</option>
                        {[
                          'INTJ', 'INTP', 'ENTJ', 'ENTP',
                          'INFJ', 'INFP', 'ENFJ', 'ENFP',
                          'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
                          'ISTP', 'ISFP', 'ESTP', 'ESFP',
                        ].map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </FormControl>

                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="speechPreset"
          render={({ field }) => {
            const v = field.value ?? ''; // ← ここがポイント
            return (
              <FormItem className="space-y-2">
                <FormLabel>話し方プリセット</FormLabel>
                <FormControl>
                  <select
                    className="w-full rounded border px-3 py-2"
                    name={field.name}
                    ref={field.ref}
                    value={v}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                  >
                    <option value="">（未設定）</option>
                    <option value="polite">ていねい</option>
                    <option value="casual">くだけた</option>
                    <option value="blunt">素っ気ない</option>
                    <option value="soft">やわらかい</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">性格（1〜5）</h3>
          {([
            { key: 'sociability', label: '社交性' },
            { key: 'empathy', label: '気配り' },
            { key: 'stubbornness', label: '頑固さ' },
            { key: 'activity', label: '行動力' },
            { key: 'expressiveness', label: '表現力' },
          ] as const).map(({ key, label }) => (
            <FormField
              key={key}
              control={form.control}
              name={`traits.${key}` as const}
              render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-5 items-center gap-3">
                    <FormLabel className="col-span-1 text-sm">{label}</FormLabel>
                    <FormControl>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        className="col-span-3 w-full"
                        value={field.value ?? DEFAULT_TRAITS[key]}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <div className="col-span-1 text-right text-sm tabular-nums">
                      {field.value ?? DEFAULT_TRAITS[key]}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        {/* 背景情報 */}
        <div className="space-y-4 pt-2 border-t">
          <h3 className="text-sm font-semibold">背景情報</h3>

          {/* 背景情報 */}
          <div className="space-y-4 pt-2 border-t">
            <h3 className="text-sm font-semibold">背景情報</h3>

            {/* 性別・年齢・職業を横並び（レスポンシブ） */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-4 md:items-start">

              {/* 性別（md: 4カラム） */}
              <div className="md:col-span-4 min-w-0">
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => {
                    const v = field.value ?? '';
                    return (
                      <FormItem className="space-y-2">
                        {/* ラベルは常に上段に出す */}
                        <FormLabel className="block">性別</FormLabel>
                        <FormControl>
                          <select
                            className="w-[150px] rounded border px-3 py-2"
                            name={field.name}
                            ref={field.ref}
                            value={v}
                            onChange={(e) => field.onChange(e.target.value)}
                            onBlur={field.onBlur}
                          >
                            <option value="">（未設定）</option>
                            <option value="male">男性</option>
                            <option value="female">女性</option>
                            <option value="nonbinary">ノンバイナリ</option>
                            <option value="other">その他</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* 年齢（md: 3カラム） */}
              <div className="md:col-span-3 min-w-0">
                <FormField
                  control={form.control}
                  name="age"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="block">年齢</FormLabel>
                      <FormControl>
                        <>
                          <Input
                            list="age-options"
                            placeholder="例：20"
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                            }
                            onBlur={field.onBlur}
                            inputMode="numeric"
                            type="text"
                            pattern="^\d{1,3}$"
                            className="w-[100px]"
                            aria-describedby="age-help"
                          />
                          <datalist id="age-options">
                            {Array.from({ length: 120 }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n} />
                            ))}
                          </datalist>
                          <p id="age-help" className="text-xs text-muted-foreground mt-1">
                            直接入力（半角数字）も、リスト（1〜120）からの選択もできます。
                          </p>
                        </>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 職業（md: 5カラム） */}
              <div className="md:col-span-5 min-w-0">
                <FormField
                  control={form.control}
                  name="occupation"
                  render={({ field }) => {
                    const v = field.value ?? '';
                    return (
                      <FormItem className="space-y-2">
                        <FormLabel className="block">職業</FormLabel>
                        <FormControl>
                          <select
                            className="w-full rounded border px-3 py-2"
                            name={field.name}
                            ref={field.ref}
                            value={v}
                            onChange={(e) => field.onChange(e.target.value)}
                            onBlur={field.onBlur}
                          >
                            <option value="">（未設定）</option>
                            <option value="student">学生</option>
                            <option value="office">会社員</option>
                            <option value="engineer">エンジニア</option>
                            <option value="teacher">教員</option>
                            <option value="parttimer">パート・アルバイト</option>
                            <option value="freelancer">フリーランス</option>
                            <option value="unemployed">無職</option>
                            <option value="other">その他</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

            </div>
          </div>

          {/* 一人称（ユーザー指定：私／僕／俺／うち／自分） */}
          <FormField
            control={form.control}
            name="firstPerson"
            render={({ field }) => {
              const v = field.value ?? '';
              return (
                <FormItem className="space-y-2">
                  <FormLabel>一人称</FormLabel>
                  <FormControl>
                    <select
                      className="w-full rounded border px-3 py-2"
                      name={field.name}
                      ref={field.ref}
                      value={v}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                    >
                      <option value="">（未設定）</option>
                      <option value="私">私</option>
                      <option value="僕">僕</option>
                      <option value="俺">俺</option>
                      <option value="うち">うち</option>
                      <option value="自分">自分</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {/* 興味関心（カンマ区切り） */}
          <div className="space-y-2">
            <FormLabel>興味・関心</FormLabel>
            {/* 追加用の入力フィールドとボタン */}
            <div className="flex gap-2">
              <Input
                placeholder="例：音楽"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                // エンターキーでも追加できるように
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newInterest) {
                    e.preventDefault();
                    append({ value: newInterest }); // ★ オブジェクトに変更
                    setNewInterest('');
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!newInterest}
                onClick={() => {
                  if (newInterest) {
                    append({ value: newInterest }); // ★ オブジェクトに変更
                    setNewInterest('');
                  }
                }}
              >
                追加
              </Button>
            </div>

            {/* 追加された項目のリスト */}
            <div className="flex flex-wrap gap-2 pt-2">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                  <span>{field.value}</span>
                  <button type="button" onClick={() => remove(index)} className="ml-1 font-bold text-muted-foreground hover:text-destructive">
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* react-hook-form の FieldArray を使う場合、<FormField> は不要だが、
                エラー（例：配列が長すぎる等）を表示したい場合は <FormMessage> をここに配置する */}
            <FormMessage />
          </div>
        </div>

        {/* 活動傾向と睡眠 */}
        <div className="space-y-4 pt-2 border-t">
          <h3 className="text-sm font-semibold">活動傾向と睡眠</h3>

          {/* 活動傾向 */}
          <FormField
            control={form.control}
            name="activityTendency"
            render={({ field }) => {
              const v = field.value ?? '';
              return (
                <FormItem className="space-y-2">
                  <FormLabel>活動傾向（クロノタイプ）</FormLabel>
                  <FormControl>
                    <select
                      className="w-full rounded border px-3 py-2"
                      name={field.name}
                      ref={field.ref}
                      value={v}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                    >
                      <option value="">（未設定）</option>
                      <option value="morning">朝型</option>
                      <option value="normal">通常</option>
                      <option value="night">夜型</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          {/* 任意：睡眠プロファイル（上書き） */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="sleepBedtime"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>就寝時刻（任意・HH:mm）</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例：23:00"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      inputMode="numeric"
                      pattern="^[0-2][0-9]:[0-5][0-9]$"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sleepWakeTime"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>起床時刻（任意・HH:mm）</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例：07:30"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      inputMode="numeric"
                      pattern="^[0-2][0-9]:[0-5][0-9]$"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* 既定値プレビュー（sleepProfile未入力時に、活動傾向からの既定を見せるだけ） */}
          {(() => {
            const t = form.watch('activityTendency') as ('morning' | 'normal' | 'night' | undefined);
            const bed = form.watch('sleepBedtime');
            const wake = form.watch('sleepWakeTime');

            // sleepProfileを未入力で activityTendency が選ばれているときだけ表示
            if (t && !bed && !wake) {
              const def = defaultSleepByTendency(t);
              return (
                <p className="text-xs text-muted-foreground">
                  既定の睡眠帯（{t === 'morning' ? '朝型' : t === 'night' ? '夜型' : '通常'}）：
                  就寝 <span className="tabular-nums">{def.bedtime}</span>／起床 <span className="tabular-nums">{def.wakeTime}</span>（就寝準備 {def.prepMinutes}分）
                </p>
              );
            }
            return null;
          })()}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={upsert.isPending}>
            {upsert.isPending ? '保存中…' : '保存'}
          </Button>
        </div>
      </form>
      {showDiagnosis && (
        <>
          {/* Backdrop（背景クリックで閉じる） */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowDiagnosis(false)}
            aria-hidden="true"
          />

          {/* 右側スライドのサイドパネル */}
          <aside
            className="fixed right-0 top-0 z-50 h-svh w-[420px] max-w-[88vw] bg-white shadow-xl border-l outline-none
                     animate-in slide-in-from-right duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold">MBTI 診断</h3>
              <button
                type="button"
                className="text-sm text-muted-foreground hover:underline"
                onClick={() => setShowDiagnosis(false)}
              >
                閉じる（Esc）
              </button>
            </div>

            <div className="flex h-[calc(100svh-48px-64px)] flex-col gap-4 overflow-y-auto px-4 py-4">
              {/* 質問リスト（スライダー） */}
              {QUESTIONS.map(q => (
                <div key={q.id} className="grid grid-cols-5 items-center gap-3">
                  <div className="col-span-3 text-sm">{q.text}</div>
                  <input
                    className="col-span-1 w-full"
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={diagScores[q.id]}
                    onChange={(e) => onDiagScoreChange(q.id, Number(e.target.value))}
                  />
                  <div className="col-span-1 text-right text-sm tabular-nums">
                    {diagScores[q.id]}
                  </div>
                </div>
              ))}
            </div>

            {/* フッター操作 */}
            <div className="flex justify-end gap-2 border-t px-4 py-3">
              <Button
                type="button"
                onClick={() => {
                  const mbti = calculateMbti(answers);
                  // ← MBTI セレクトにだけ結果を反映（保存は元の「保存」ボタン）
                  form.setValue('mbti', mbti, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                  setShowDiagnosis(false);
                }}
              >
                診断して反映
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowDiagnosis(false)}
              >
                反映せず閉じる
              </Button>
            </div>
          </aside>
        </>
      )}

    </Form>
  );
}
