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
import { ClickableRatingBox } from '@/components/ui/clickable-rating-box';
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea';
// ★ TODO: 将来的には usePresets フックなどから動的に取得する
// import { usePresets } from '@/lib/data/presets';

// === フォーム内で使う選択肢（まずは固定配列で運用） ===
const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;

// traits の初期値（未設定でも落ちないように）
const DEFAULT_TRAITS = {
  sociability: 3,    // 社交性
  empathy: 3,        // 気配り
  stubbornness: 3,   // 頑固さ
  activity: 3,       // 行動力
  expressiveness: 3, // 表現力
} as const;

// DBから取得した「管理プリセット (isManaged: true)」のモックデータ
type ManagedPreset = { id: string; label: string; description?: string | null };

const MOCK_MANAGED_PRESETS: Record<'speech' | 'occupation' | 'first_person', ManagedPreset[]> = {
  speech: [
    { id: 'uuid-s1', label: 'ていねい', description: '常に敬語を使い、相手を尊重する話し方。' },
    { id: 'uuid-s2', label: 'くだけた', description: '友人や親しい人との間で使われる、フレンドリーな話し方。' },
  ],
  occupation: [
    { id: 'uuid-o1', label: '学生' },
    { id: 'uuid-o2', label: '会社員' },
    { id: 'uuid-o3', label: 'エンジニア' },
  ],
  first_person: [
    { id: 'uuid-f1', label: '私' },
    { id: 'uuid-f2', label: '僕' },
  ],
};

// フォームのZodスキーマ。DBスキーマ (Resident) とは異なる。
// ここでは「ラベル」（文字列）と「管理フラグ」を保持する。
const residentFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, '名前は必須です'),
  mbti: z.string().optional().nullable(),
  traits: z.object({
    sociability: z.number().int().min(1).max(5),
    empathy: z.number().int().min(1).max(5),
    stubbornness: z.number().int().min(1).max(5),
    activity: z.number().int().min(1).max(5),
    expressiveness: z.number().int().min(1).max(5),
  }),
  trustToPlayer: z.number().min(0).max(100).optional(),

  // --- プリセット項目 (ラベル) ---
  speechPreset: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  firstPerson: z.string().optional().nullable(),
  // ★ 追加: 話し方の特徴
  speechPresetDescription: z.string().optional().nullable(),

  // --- プリセット管理フラグ ---
  isSpeechPresetManaged: z.boolean().default(false),
  isOccupationManaged: z.boolean().default(false),
  isFirstPersonManaged: z.boolean().default(false),

  // --- その他 (変更なし) ---
  gender: z.preprocess(
    v => (v === '' || v == null ? undefined : v),
    z.enum(['male', 'female', 'nonbinary', 'other']).optional()
  ),
  age: z.preprocess(
    v => (v === '' || v == null ? undefined : Number(v)),
    z.number().int().min(0).max(120).optional()
  ),
  interests: z.array(z.object({ value: z.string() })).optional(),
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

// ★ 3. findOrCreatePreset (モック) のシグネチャを変更
const findOrCreatePreset = async (
  label: string | undefined | null,
  category: 'speech' | 'occupation' | 'first_person',
  isManaged: boolean,
  // ★ description を引数に追加
  description?: string | undefined | null
): Promise<string | undefined> => { // UUID を返す
  if (!label || label.trim().length === 0) {
    return undefined;
  }
  const trimmedLabel = label.trim();

  // (モック) 非管理プリセットの追加
  const allPresetsMock: ManagedPreset[] = [ // ★ 型を明示
    ...MOCK_MANAGED_PRESETS[category],
    { id: 'uuid-o4', label: '浪人生' },
    { id: 'uuid-f3', label: '拙者' },
  ];
  const existing = allPresetsMock.find(p => p.label === trimmedLabel);

  if (existing) {
    // 2. 存在する場合
    // (ここでは isManaged や description の更新ロジックは省略し、IDを返すだけ)
    if (isManaged) {
      // TODO: API 呼び出し (updatePreset(existing.id, { isManaged: true, description }))
      console.log(`Preset ${trimmedLabel} (${existing.id}) を 'managed' に更新 (モック)`);
    } else if (category === 'speech' && description) {
      // TODO: API 呼び出し (updatePreset(existing.id, { description }))
      console.log(`Preset ${trimmedLabel} (${existing.id}) の 'description' を更新 (モック)`);
    }
    return existing.id; // 既存のUUIDを返す
  }

  // 3. 存在しない場合 (新規作成)
  const newId = crypto.randomUUID();
  // TODO: API 呼び出し (createPreset({ label: trimmedLabel, category, isManaged, description }))
  console.log(`Preset ${trimmedLabel} を新規作成 (isManaged: ${isManaged}) (Desc: ${description}) (ID: ${newId}) (モック)`);
  // 新しいUUIDを返す
  return newId;
};

export function ResidentForm({
  defaultValues,
  onSubmitted,
}: {
  defaultValues?: Partial<Resident>;
  onSubmitted?: () => void;
}) {
  const router = useRouter();

  // ★ 変更: モックデータを読み込む
  const speechPresets = MOCK_MANAGED_PRESETS.speech;
  const occupationPresets = MOCK_MANAGED_PRESETS.occupation;
  const firstPersonPresets = MOCK_MANAGED_PRESETS.first_person;

  const form = useForm<ResidentFormValues>({
    // ... (defaultValues の設定は変更なし) ...
    resolver: zodResolver(residentFormSchema),
    defaultValues: useMemo(() => {
      // ★ 4. defaultValues (DB) から フォーム (FormValues) への変換ロジック

      // (モック) DBのUUIDから対応するプリセットを引く
      // 実際には defaultValues にプリセット情報もJOINするか、別途フェッチする
      const findPreset = (id: string | undefined, category: 'speech' | 'occupation' | 'first_person'): ManagedPreset | undefined => {
        const presets: ManagedPreset[] = MOCK_MANAGED_PRESETS[category]; // 型を保証
        return presets.find(p => p.id === id);
      };
      const defaultSpeechPreset = findPreset(defaultValues?.speechPreset, 'speech');
      const defaultOccPreset = findPreset(defaultValues?.occupation, 'occupation');
      const defaultFpPreset = findPreset(defaultValues?.firstPerson, 'first_person');

      const traitsObj =
        defaultValues?.traits && typeof defaultValues.traits === 'object'
          ? (defaultValues.traits as any)
          : { ...DEFAULT_TRAITS };

      return {
        ...defaultValues,
        name: defaultValues?.name ?? '',
        mbti: defaultValues?.mbti ?? '',
        traits: traitsObj,
        trustToPlayer: defaultValues?.trustToPlayer ?? 50,
        // ★ フォームにはラベルと特徴を設定
        speechPreset: defaultSpeechPreset?.label ?? '',
        speechPresetDescription: defaultSpeechPreset?.description ?? '', // ★ 特徴
        occupation: defaultOccPreset?.label ?? '',
        firstPerson: defaultFpPreset?.label ?? '',
        // ★ 管理フラグはデフォルトOFF
        isSpeechPresetManaged: false,
        isOccupationManaged: false,
        isFirstPersonManaged: false,
        interests: defaultValues?.interests?.map(val => ({ value: val })) ?? [],
      };
    }, [defaultValues]),
  });

  // ... (診断パネルのロジックは変更なし) ...
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
    // ★ 1. フォームの「ラベル」から UUID を非同期で取得/作成
    const [speechPresetId, occupationId, firstPersonId] = await Promise.all([
      findOrCreatePreset(values.speechPreset, 'speech', values.isSpeechPresetManaged),
      findOrCreatePreset(values.occupation, 'occupation', values.isOccupationManaged),
      findOrCreatePreset(values.firstPerson, 'first_person', values.isFirstPersonManaged),
    ]);

    // ★ 2. 他の項目を正規化 (変更なし)
    const normalizedMbti: (typeof MBTI_TYPES)[number] | undefined =
      values.mbti && values.mbti.trim().length > 0
        ? (values.mbti as (typeof MBTI_TYPES)[number])
        : undefined;
    const gender = values.gender as ('male' | 'female' | 'nonbinary' | 'other') | undefined;
    const interests = values.interests?.map(item => item.value).filter(Boolean) ?? [];
    const activityTendency = values.activityTendency as ('morning' | 'normal' | 'night') | undefined;
    const sleepProfile =
      values.sleepBedtime && values.sleepWakeTime
        ? {
          bedtime: values.sleepBedtime,
          wakeTime: values.sleepWakeTime,
          prepMinutes: 30,
        }
        : undefined;

    // ★ 3. 最終的なペイロード (DBの型) を作成
    const payload: Partial<Resident> = {
      id: values.id,
      name: values.name,
      mbti: normalizedMbti,
      traits: values.traits,

      // ★ ここに変換後の UUID をセット
      speechPreset: speechPresetId,
      occupation: occupationId,
      firstPerson: firstPersonId,

      gender,
      age: typeof values.age === 'number' ? values.age : undefined,
      interests: interests.length > 0 ? interests : undefined,
      activityTendency,
      ...(sleepProfile ? { sleepProfile } : {}),
    };

    const saved = await upsert.mutateAsync(payload);

    // (モック) 保存されたUUIDからプリセットを探す
    const findPreset = (id: string | undefined, category: 'speech' | 'occupation' | 'first_person'): ManagedPreset | undefined => {
      const presets: ManagedPreset[] = MOCK_MANAGED_PRESETS[category]; // 型を保証
      return presets.find(p => p.id === id);
    };
    // ★ 4. フォームのリセット (saved は DB の型 = UUID持ち)
    // (ここでも UUID から ラベルへの逆引きが必要)
    const savedSpeechPreset = findPreset(saved.speechPreset, 'speech');
    const savedOccPreset = findPreset(saved.occupation, 'occupation');
    const savedFpPreset = findPreset(saved.firstPerson, 'first_person');

    // form.reset (変更なし)
    form.reset({
      ...values, // フォームの基本値は維持
      id: saved.id,
      name: saved.name,
      mbti: saved.mbti ?? '',
      traits: saved.traits ?? { ...DEFAULT_TRAITS },
      trustToPlayer: saved.trustToPlayer ?? 50,

      // ★ フォームにはラベルを戻す
      speechPreset: savedSpeechPreset?.label ?? (values.speechPreset ?? ''),
      speechPresetDescription: savedSpeechPreset?.description ?? (values.speechPresetDescription ?? ''),
      occupation: savedOccPreset?.label ?? (values.occupation ?? ''),
      firstPerson: savedFpPreset?.label ?? (values.firstPerson ?? ''),

      // ★ 管理フラグはリセット
      isSpeechPresetManaged: false,
      isOccupationManaged: false,
      isFirstPersonManaged: false,

      // ★ DB の型からフォームの型へ
      interests: saved.interests?.map(val => ({ value: val })) ?? [],
      sleepBedtime: saved.sleepProfile?.bedtime ?? '',
      sleepWakeTime: saved.sleepProfile?.wakeTime ?? '',
    });

    onSubmitted?.();
  }

  // ... (useFieldArray, newInterest のロジックは変更なし) ...
  // ★ 追加: 興味・関心 (useFieldArray)
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "interests",
  });

  // ★ 追加: 新しく追加する興味・関心の入力値を管理
  const [newInterest, setNewInterest] = useState('');

  const watchSpeechPresetLabel = form.watch('speechPreset');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* ... (name, mbti フィールドは変更なし) ... */}
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

        {/* ... (性格 traits セクションは変更なし) ... */}
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
                  {/* グリッドの分割を 2 (ラベル) : 3 (ボックス) に変更 */}
                  <div className="grid grid-cols-5 items-center gap-3">
                    <FormLabel className="col-span-2 text-sm">{label}</FormLabel>

                    {/* --- 変更後 (追加) --- */}
                    <div className="col-span-3">
                      <FormControl>
                        <ClickableRatingBox
                          value={field.value ?? DEFAULT_TRAITS[key]}
                          onChange={(newValue) => field.onChange(newValue)}
                        />
                      </FormControl>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        {/* ★ 変更: 話し方プリセット */}
        <div className="space-y-3 rounded-md border p-3">
          <FormField
            control={form.control}
            name="speechPreset"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>話し方（ラベル）</FormLabel>
                <FormControl>
                  <Input
                    placeholder="例：ていねい（手動入力も可）"
                    list="speech-preset-options"
                    {...field}
                    value={field.value ?? ''} // ここには「ラベル」が入る
                  />
                </FormControl>
                <datalist id="speech-preset-options">
                  {speechPresets.map((preset) => (
                    <option key={preset.id} value={preset.label} />
                  ))}
                </datalist>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* ★ 10. 「特徴」の Textarea を追加 */}
          {/* ラベルが入力されている時だけ表示 */}
          {watchSpeechPresetLabel && (
            <FormField
              control={form.control}
              name="speechPresetDescription"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>話し方の特徴（AIへの指示）</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="例：常に敬語を使い、相手を尊重する話し方。"
                      {...field}
                      value={field.value ?? ''}
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="isSpeechPresetManaged"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-end space-x-2">
                <FormLabel className="text-sm text-muted-foreground">
                  この話し方をプリセット管理に追加
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* 基本情報 */}
        <div className="space-y-4 pt-2 border-t">
          <h3 className="text-sm font-semibold">基本情報</h3>

          {/* 性別・年齢・職業を横並び（レスポンシブ） */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-4 md:items-start">

            {/* 性別（md: 4カラム） (変更なし) */}
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
                          <option value="nonbinary">なし</option>
                          <option value="other">その他</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            {/* 年齢（md: 3カラム） (変更なし) */}
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

            {/* ★ 変更: 職業 */}
            <div className="md:col-span-5 min-w-0 space-y-2">
              <FormField
                control={form.control}
                name="occupation"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="block">職業</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例：学生（手動入力も可）"
                        list="occupation-options"
                        className="w-full"
                        {...field}
                        value={field.value ?? ''} // ラベル
                      />
                    </FormControl>
                    <datalist id="occupation-options">
                      {occupationPresets.map((preset) => (
                        <option key={preset.id} value={preset.label} />
                      ))}
                    </datalist>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isOccupationManaged"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-end space-x-2 pt-1">
                    <FormLabel className="text-sm text-muted-foreground">
                      プリセット管理に追加
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        {/* ★ 変更: 一人称 */}
        <div className="space-y-2 rounded-md border p-3">
          <FormField
            control={form.control}
            name="firstPerson"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>一人称</FormLabel>
                <FormControl>
                  <Input
                    placeholder="例：私（手動入力も可）"
                    list="first-person-options"
                    className="w-full"
                    {...field}
                    value={field.value ?? ''} // ラベル
                  />
                </FormControl>
                <datalist id="first-person-options">
                  {firstPersonPresets.map((preset) => (
                    <option key={preset.id} value={preset.label} />
                  ))}
                </datalist>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isFirstPersonManaged"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-end space-x-2">
                <FormLabel className="text-sm text-muted-foreground">
                  プリセット管理に追加
                </FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* ... (興味関心、活動傾向、保存ボタン、診断パネル は変更なし) ... */}
        {/* 興味関心（カンマ区切り） */}
        <div className="space-y-2">
          <FormLabel>興味・関心</FormLabel>
          {/* 追加用の入力フィールドとボタン */}
          <div className="flex gap-2">
            <Input
              placeholder="例：音楽"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newInterest) {
                  e.preventDefault();
                  append({ value: newInterest });
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
                  append({ value: newInterest });
                  setNewInterest('');
                }
              }}
            >
              追加
            </Button>
          </div>
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
          <FormMessage />
        </div>

        {/* 活動傾向 */}
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

      {/* --- 診断パネル (MBTI診断) --- */}
      {/* (前回修正した ClickableRatingBox が使われている状態) */}
      {
        showDiagnosis && (
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
              {/* ... (パネルのヘッダー) ... */}
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
                {QUESTIONS.map((q) => (
                  <div key={q.id} className="grid grid-cols-5 items-center gap-3">
                    <div className="col-span-3 text-sm">{q.text}</div>
                    <div className="col-span-2">
                      <ClickableRatingBox
                        value={diagScores[q.id]}
                        onChange={(newValue) => onDiagScoreChange(q.id, newValue)}
                      />
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
        )
      }
    </Form >
  );
}