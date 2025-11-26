'use client';

import React from 'react';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Resident, Preset } from '@/types';
import type {
  ResidentWithRelations,
  TempRelationData,
  RelationType,
  PresetCategory,
} from '@/types';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useUpsertResident, useResidents } from '@/lib/data/residents';
import { useMemo, useState, useEffect } from 'react';
import { QUESTIONS, calculateMbti, type Answer } from '@/lib/mbti';
import { useRouter } from 'next/navigation';
import { BaseSleepProfile, SleepProfile } from '../../../../packages/shared/logic/schedule';
import { ClickableRatingBox } from '@/components/ui/clickable-rating-box';
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { relationTypeEnum } from '@/lib/drizzle/schema';
import { useFormDirty } from '@/components/providers/FormDirtyProvider';
import { useLeaveConfirm } from '@/lib/hooks/useLeaveConfirm';
import { usePresetsByCategory, useUpsertPreset } from '@/lib/data/presets';
import { Loader2 } from 'lucide-react';
import { DEFAULT_TRAITS, RELATION_LABELS, TRAIT_LABELS } from '@/lib/constants/labels';

// === フォーム内で使う選択肢（まずは固定配列で運用） ===
const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;

// 追加: 0時〜23時の選択肢を生成
const HOURS_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = String(i);
  return {
    value: hour, // "0", "1", ... "23"
    label: `${i} 時頃`,
  };
});

// 職業・一人称の <Select> で使う「手動入力」用の特別な値
const MANUAL_INPUT_KEY = '--manual--';

// フォームのZodスキーマ
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
  speechPreset: z.string({ required_error: '口調を選択してください' }).min(1, '口調を選択してください'),
  occupation: z.string().optional().nullable(),
  firstPerson: z.string({ required_error: '一人称を選択してください' }).min(1, '一人称を選択してください'),
  speechPresetDescription: z.string().optional().nullable(),
  speechPresetExample: z.string().optional().nullable(),

  // --- プリセット管理フラグ ---
  isSpeechPresetManaged: z.boolean().default(false),
  isOccupationManaged: z.boolean().default(false),
  isFirstPersonManaged: z.boolean().default(false),

  gender: z.preprocess(
    v => (v === '' || v == null ? undefined : v),
    z.enum(['male', 'female', 'nonbinary', 'other'], {
      required_error: '性別を選択してください'
    })
  ),
  age: z.preprocess(
    v => (v === '' || v == null ? undefined : Number(v)),
    z.number().int().min(0).max(120).optional()
  ),

  // 誕生日 (月)
  birthMonth: z.preprocess(
    v => (v === '' || v == null ? undefined : Number(v)),
    z.number().int().min(1).max(12).optional()
  ),
  // 誕生日 (日)
  birthDay: z.preprocess(
    v => (v === '' || v == null ? undefined : Number(v)),
    z.number().int().min(1).max(31).optional()
  ),

  interests: z.array(z.object({ value: z.string() })).optional(),

  // 必須項目にするため .number({ required_error: ... }) を使用
  sleepBedtime: z.preprocess(
    v => (v === '' || v == null ? undefined : Number(v)),
    z.number({ required_error: '時刻を選択してください' }).int().min(0).max(23)
  ),
  sleepWakeTime: z.preprocess(
    v => (v === '' || v == null ? undefined : Number(v)),
    z.number({ required_error: '時刻を選択してください' }).int().min(0).max(23)
  ),
});

type ResidentFormValues = z.infer<typeof residentFormSchema>;

// Relation_Sim の defaultAffections に相当
const defaultScores: Record<RelationType, number> = {
  none: 0,
  friend: 20,
  best_friend: 40,
  lover: 60,
  family: 60,
};

const DEFAULT_TEMP_RELATION: TempRelationData = {
  relationType: 'none',
  feelingLabelTo: 'none',
  feelingScoreTo: 50,
  feelingLabelFrom: 'none',
  feelingScoreFrom: 50,
  nicknameTo: '',
  nicknameFrom: '',
};

export function ResidentForm({
  defaultValues,
  onSubmitted,
}: {
  // 編集時は Relation データも受け取る
  defaultValues?: Partial<Resident>;
  onSubmitted?: () => void;
}) {
  const router = useRouter();

  const formDefaultValues = defaultValues as Partial<ResidentWithRelations>;

  const { data: speechPresets = [], isLoading: isLoadingSpeech } = usePresetsByCategory('speech');
  const { data: occPresets = [], isLoading: isLoadingOcc } = usePresetsByCategory('occupation');
  const { data: fpPresets = [], isLoading: isLoadingFp } = usePresetsByCategory('first_person');

  // すべてのプリセットをマージ (デフォルトプリセット含む)
  const allPresets = useMemo(() => {
    return [...speechPresets, ...occPresets, ...fpPresets];
  }, [speechPresets, occPresets, fpPresets]);

  // ローディング状態をマージ
  const isLoadingPresets = isLoadingSpeech || isLoadingOcc || isLoadingFp;

  const upsertPreset = useUpsertPreset();

  const findOrCreatePreset = async (
    label: string | undefined | null,
    category: PresetCategory,
    isManaged: boolean,
    extras?: { description?: string | null; example?: string | null }
  ): Promise<string | undefined> => {
    if (!label || label.trim().length === 0) {
      return undefined;
    }
    const trimmedLabel = label.trim();
    const speechDescription = extras?.description ?? null;
    const speechExample = extras?.example ?? null;

    const allCategoryPresets = allPresets.filter((p: Preset) => p.category === category);
    const existing = allCategoryPresets.find((p: Preset) => p.label === trimmedLabel);

    if (existing) {
      let needsUpdate = false;
      const updatePayload: Partial<Preset> = { id: existing.id };

      if (isManaged && !existing.isManaged) {
        updatePayload.isManaged = true;
        needsUpdate = true;
      }
      if (category === 'speech' && speechDescription !== existing.description) {
        updatePayload.description = speechDescription;
        needsUpdate = true;
      }
      if (category === 'speech' && speechExample !== existing.example) {
        updatePayload.example = speechExample;
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log(`Preset ${trimmedLabel} (${existing.id}) を更新します`, updatePayload);
        // (フックから取得した upsertPreset を参照)
        await upsertPreset.mutateAsync(updatePayload);
      }
      return existing.id;
    }

    const newPreset: Partial<Preset> = {
      label: trimmedLabel,
      category,
      isManaged,
      description: category === 'speech' ? speechDescription : undefined,
      example: category === 'speech' ? speechExample : undefined,
    };
    console.log(`Preset ${trimmedLabel} を新規作成 (isManaged: ${isManaged})`, newPreset);
    // (フックから取得した upsertPreset を参照)
    const savedPreset = await upsertPreset.mutateAsync(newPreset);
    return savedPreset.id;
  };

  const findPresetById = (id: string | undefined): Preset | undefined => {
    if (!id || isLoadingPresets) return undefined;
    return allPresets.find((p: Preset) => p.id === id);
  };


  // フォームで使う「管理プリセット」
  const managedPresets = useMemo(() => {
    const speech = allPresets
      .filter((p: Preset) => p.category === 'speech' && p.isManaged)
      .sort((a: Preset, b: Preset) => a.label.localeCompare(b.label));
    const occupation = allPresets
      .filter((p: Preset) => p.category === 'occupation' && p.isManaged)
      .sort((a: Preset, b: Preset) => a.label.localeCompare(b.label));
    const first_person = allPresets
      .filter((p: Preset) => p.category === 'first_person' && p.isManaged)
      .sort((a: Preset, b: Preset) => a.label.localeCompare(b.label));
    return { speech, occupation, first_person };
  }, [allPresets]);

  const defaultSpeechPreset = findPresetById(formDefaultValues?.speechPreset);
  const defaultOccPreset = findPresetById(formDefaultValues?.occupation);
  const defaultFpPreset = findPresetById(formDefaultValues?.firstPerson);

  const form = useForm<ResidentFormValues>({
    resolver: zodResolver(residentFormSchema),
    defaultValues: useMemo(() => {
      const traitsObj =
        formDefaultValues?.traits && typeof formDefaultValues.traits === 'object'
          ? (formDefaultValues.traits as any)
          : { ...DEFAULT_TRAITS };
      const timeToHour = (time: string | undefined): number | undefined => {
        if (typeof time === 'string' && time.includes(':')) {
          const hour = parseInt(time.split(':')[0], 10);
          return isNaN(hour) ? undefined : hour;
        }
        return undefined;
      };
      const currentSleepProfile = (formDefaultValues?.sleepProfile ?? {}) as Partial<SleepProfile>;
      const [defaultMonth, defaultDay] = (formDefaultValues?.birthday ?? '/').split('/');
      const birthMonthNum = defaultMonth ? parseInt(defaultMonth, 10) : undefined;
      const birthDayNum = defaultDay ? parseInt(defaultDay, 10) : undefined;

      return {
        ...formDefaultValues,
        name: formDefaultValues?.name ?? '',
        mbti: formDefaultValues?.mbti ?? undefined,
        traits: traitsObj,
        trustToPlayer: formDefaultValues?.trustToPlayer ?? 50,

        speechPreset: defaultSpeechPreset?.label ?? undefined,
        speechPresetDescription: defaultSpeechPreset?.description ?? null,
        speechPresetExample: defaultSpeechPreset?.example ?? null,
        occupation: defaultOccPreset?.label ?? null,
        firstPerson: defaultFpPreset?.label ?? undefined,

        isSpeechPresetManaged: false,
        isOccupationManaged: false,
        isFirstPersonManaged: false,
        interests: formDefaultValues?.interests?.map(val => ({ value: val })) ?? [],

        birthMonth: isNaN(birthMonthNum as number) ? undefined : birthMonthNum,
        birthDay: isNaN(birthDayNum as number) ? undefined : birthDayNum,

        sleepBedtime: timeToHour(currentSleepProfile.baseBedtime),
        sleepWakeTime: timeToHour(currentSleepProfile.baseWakeTime),
      };
      // 依存配列にプリセットのロード状態を追加
    }, [formDefaultValues, defaultSpeechPreset, defaultOccPreset, defaultFpPreset]),
  });

  // ローカルの isDirty 状態を取得
  const { isDirty: isFormDirty } = form.formState;

  // グローバル状態のセッターを取得
  const { setIsDirty: setGlobalDirty } = useFormDirty();

  // ローカルの isDirty をグローバル状態に同期
  useEffect(() => {
    setGlobalDirty(isFormDirty);

  }, [isFormDirty, setGlobalDirty]);

  // ブラウザ操作 (リロード/戻る) の監視フックを呼び出す
  useLeaveConfirm();

  // 他の住人リストを取得 (自分を除く)
  const { data: allResidents } = useResidents();
  const otherResidents = useMemo(() => {
    if (!allResidents) return [];
    const currentId = formDefaultValues?.id;
    if (currentId) {
      // 編集モード：自分を除外
      return allResidents.filter(r => r.id !== currentId);
    }
    // 新規作成モード：既存の住人をすべて返す
    return allResidents;
  }, [allResidents, formDefaultValues?.id]);

  // フォーム内の関係設定を管理する State
  const [tempRelations, setTempRelations] = useState<Record<string, TempRelationData>>(() => {
    // defaultValues.initialRelations (加工済み) ではなく、
    // defaultValues (DBからの生データ) と otherResidents から
    // フォーム用の tempRelations を「生成」する
    return initializeTempRelations(formDefaultValues, otherResidents);
  });

  // (追加) defaultValues や otherResidents が非同期でロードされたら State を再同期
  // (useState の遅延初期化は一度しか実行されないため、
  //  DBデータ (formDefaultValues) や住人リスト (otherResidents) が
  //  後からロードされた場合に備えて Effect で再設定する)
  useEffect(() => {
    // 既存の tempRelations (ユーザーが編集中の可能性) とマージする
    const newRelations = initializeTempRelations(formDefaultValues, otherResidents);

    // 既存の値を尊重しつつ、新しい初期値をマージする
    setTempRelations(prev => {
      const merged = { ...newRelations };
      // ユーザーが既に編集した値 (prev) があれば、そちらを優先する
      // (ただし、この例では簡潔さのため newRelations で上書き)
      // ※より厳密には new と prev の deep merge が必要だが、
      // フォームロード時の一回限りの初期化と割り切る
      return newRelations;
    });

  }, [formDefaultValues, otherResidents]); // 依存配列に

  // 関係設定の State を更新するヘルパー
  const handleRelationChange = (
    targetId: string,
    field: keyof TempRelationData,
    value: string | number | RelationType
  ) => {
    setTempRelations(prev => {
      // ターゲットIDの現在の設定 (なければデフォルト)
      const currentRelation = prev[targetId] ?? { ...DEFAULT_TEMP_RELATION };
      // 特定のフィールドを更新
      const updatedRelation = { ...currentRelation, [field]: value };

      return {
        ...prev,
        [targetId]: updatedRelation,
      };
    });
  };

  //  初期化ロジック (コンポーネント内ヘルパー)
  function initializeTempRelations(
    defaults: Partial<ResidentWithRelations>,
    others: Resident[]
  ): Record<string, TempRelationData> {

    // 編集モードでない、または他の住人がいない場合は空
    // `!defaults` のチェックを先頭に追加
    if (!defaults || !defaults.id || !others || others.length === 0) {
      return {};
    }

    const currentId = defaults.id;
    const initial: Record<string, TempRelationData> = {};

    // DBからロードした生の配列データ
    const relationsArr = defaults.relations ?? [];
    const feelingsFromArr = defaults.feelingsFrom ?? []; // 自分 -> 相手
    const feelingsToArr = defaults.feelingsTo ?? [];     // 相手 -> 自分
    const nicknamesToArr = defaults.nicknamesTo ?? [];   // 自分が相手を呼ぶ
    const nicknamesFromArr = defaults.nicknamesFrom ?? []; // 相手が自分を呼ぶ

    for (const target of others) {
      const targetId = target.id;

      // 該当するデータを探す
      const relation = relationsArr.find(r => r.b_id === targetId);
      const feelingTo = feelingsFromArr.find(f => f.to_id === targetId);
      const feelingFrom = feelingsToArr.find(f => f.from_id === targetId);
      const nicknameTo = nicknamesToArr.find(n => n.to_id === targetId);
      const nicknameFrom = nicknamesFromArr.find(n => n.from_id === targetId);

      // フォーム用の TempRelationData を構築
      initial[targetId] = {
        relationType: relation?.type ?? 'none',

        feelingLabelTo: feelingTo?.label ?? 'none',
        feelingScoreTo: feelingTo?.score ?? 50,

        feelingLabelFrom: feelingFrom?.label ?? 'none',
        feelingScoreFrom: feelingFrom?.score ?? 50,

        nicknameTo: nicknameTo?.nickname ?? '',
        nicknameFrom: nicknameFrom?.nickname ?? '',
      };
    }
    return initial;
  };

  // 選択中の住人ID
  const [editingRelationTargetId, setEditingRelationTargetId] = useState<string | null>(null);

  // 選択中の住人オブジェクトを取得するヘルパー
  const selectedRelationTarget = useMemo(() => {
    if (!editingRelationTargetId) return null;
    return otherResidents.find(r => r.id === editingRelationTargetId);
  }, [editingRelationTargetId, otherResidents]);

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
    // findOrCreatePreset が DBフック (allPresets) を参照するため、
    // ここで allPresets を参照できるようにする

    // フォームの「ラベル」から UUID を非同期で取得/作成
    const [speechPresetId, occupationId, firstPersonId] = await Promise.all([
      findOrCreatePreset(
        values.speechPreset,
        'speech',
        values.isSpeechPresetManaged,
        {
          description: values.speechPresetDescription,
          example: values.speechPresetExample,
        }
      ),
      findOrCreatePreset(values.occupation, 'occupation', values.isOccupationManaged),
      findOrCreatePreset(values.firstPerson, 'first_person', values.isFirstPersonManaged),
    ]);

    // ... (normalizedMbti, gender, interests, hourToTime, sleepProfile, birthday のロジックは変更なし) ...
    const normalizedMbti: (typeof MBTI_TYPES)[number] | undefined =
      values.mbti && values.mbti.trim().length > 0
        ? (values.mbti as (typeof MBTI_TYPES)[number])
        : undefined;
    const gender = values.gender as ('male' | 'female' | 'nonbinary' | 'other') | undefined;
    const interests = values.interests?.map(item => item.value).filter(Boolean) ?? [];
    const hourToTime = (hour: number | undefined): string | undefined => {
      if (hour == null) return undefined;
      return String(hour).padStart(2, '0') + ':00';
    };
    const currentSleepProfile = (formDefaultValues?.sleepProfile ?? {}) as Partial<SleepProfile>;
    const sleepProfile =
      (values.sleepBedtime != null && values.sleepWakeTime != null)
        ? {
          ...currentSleepProfile,
          baseBedtime: hourToTime(values.sleepBedtime)!,
          baseWakeTime: hourToTime(values.sleepWakeTime)!,
          prepMinutes: 30,
        }
        : undefined;
    const birthday =
      values.birthMonth != null && values.birthDay != null
        ? `${String(values.birthMonth).padStart(2, '0')}/${String(values.birthDay).padStart(2, '0')}`
        : undefined;

    // 最終的なペイロード (DBの型) を作成
    const payload: Partial<Resident> = {
      id: values.id,
      name: values.name,
      mbti: normalizedMbti,
      traits: values.traits,

      // ここに変換後の UUID をセット
      speechPreset: speechPresetId,
      occupation: occupationId,
      firstPerson: firstPersonId,

      gender,
      age: typeof values.age === 'number' ? values.age : undefined,
      interests: interests.length > 0 ? interests : undefined,
      birthday: birthday,
      ...(sleepProfile ? { sleepProfile } : {}),
    };

    // 住民データ (payload) と関係データ (tempRelations) を渡す
    const saved = await upsert.mutateAsync({
      resident: payload,
      relations: tempRelations,
    });

    // フォームのリセット (saved は DB の型 = UUID持ち)
    // (findPresetById を使う)
    const savedSpeechPreset = findPresetById(saved.speechPreset);
    const savedOccPreset = findPresetById(saved.occupation);
    const savedFpPreset = findPresetById(saved.firstPerson);

    // 変換ヘルパー (formDefaultValues と同じ)
    const timeToHour = (time: string | undefined): number | undefined => {
      // time が文字列であり、かつ ':' を含む場合のみ処理を続行
      if (typeof time === 'string' && time.includes(':')) {
        const hour = parseInt(time.split(':')[0], 10);
        return isNaN(hour) ? undefined : hour;
      }
      // それ以外 (undefined, null, 空文字, ':' がない文字列) は undefined を返す
      return undefined;
    };

    const [savedMonth, savedDay] = (saved.birthday ?? '/').split('/');
    const resetBirthMonth = savedMonth ? parseInt(savedMonth, 10) : undefined;
    const resetBirthDay = savedDay ? parseInt(savedDay, 10) : undefined;

    // form.reset (変更なし)
    form.reset({
      ...values,
      id: saved.id,
      name: saved.name,
      mbti: saved.mbti ?? '',
      traits: saved.traits ?? { ...DEFAULT_TRAITS },
      trustToPlayer: saved.trustToPlayer ?? 50,

      // DBデータ(savedPreset)からラベルをセット
      speechPreset: savedSpeechPreset?.label ?? (values.speechPreset ?? null),
      speechPresetDescription: savedSpeechPreset?.description ?? (values.speechPresetDescription ?? null),
      speechPresetExample: savedSpeechPreset?.example ?? (values.speechPresetExample ?? null),
      occupation: savedOccPreset?.label ?? (values.occupation ?? null),
      firstPerson: savedFpPreset?.label ?? (values.firstPerson ?? null),

      // 管理フラグはリセット
      isSpeechPresetManaged: false,
      isOccupationManaged: false,
      isFirstPersonManaged: false,

      // DB の型からフォームの型へ
      interests: saved.interests?.map(val => ({ value: val })) ?? [],

      birthMonth: isNaN(resetBirthMonth as number) ? undefined : resetBirthMonth,
      birthDay: isNaN(resetBirthDay as number) ? undefined : resetBirthDay,

      // 変更: 変換関数を使う
      sleepBedtime: timeToHour(saved.sleepProfile?.baseBedtime),
      sleepWakeTime: timeToHour(saved.sleepProfile?.baseWakeTime),
    });

    // onSubmitted の前にグローバル Dirty を手動で解除
    // handleSubmit が成功したら、遷移アラートは不要
    setGlobalDirty(false);
    onSubmitted?.();
  }

  // 興味・関心 (useFieldArray)
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "interests",
  });

  // 新しく追加する興味・関心の入力値を管理
  const [newInterest, setNewInterest] = useState('');

  // 3つのプリセットすべての状態を監視
  const watchSpeechPreset = form.watch('speechPreset');
  const watchOccupation = form.watch('occupation');
  const watchFirstPerson = form.watch('firstPerson');
  const watchName = form.watch('name');
  const speechExamplePlaceholder = useMemo(() => {
    return `例: 「今日はいい感じだね。」のように書いてください`;
  }, [watchFirstPerson]);

  // マネージドプリセットのリストを MOCK -> DBフック (managedPresets) に変更
  const speechPresetLabels = useMemo(() => managedPresets.speech.map(p => p.label), [managedPresets.speech]);
  const occupationPresetLabels = useMemo(() => managedPresets.occupation.map(p => p.label), [managedPresets.occupation]);
  const firstPersonPresetLabels = useMemo(() => managedPresets.first_person.map(p => p.label), [managedPresets.first_person]);

  // 「手動入力」モードかどうかを判定
  // (値が空文字'' = 手動入力が選択された直後 OR 値が存在し、かつプリセットリストに無い = 手動入力中/非管理データ)
  const isSpeechManual = (watchSpeechPreset === '') || (watchSpeechPreset != null && !speechPresetLabels.includes(watchSpeechPreset));
  const isOccupationManual = (watchOccupation === '') || (watchOccupation != null && !occupationPresetLabels.includes(watchOccupation));
  const isFirstPersonManual = (watchFirstPerson === '') || (watchFirstPerson != null && !firstPersonPresetLabels.includes(watchFirstPerson));

  return (
    <Form {...form}>

      {/* 0時〜23時の Datalist (Age を参考に) */}
      <datalist id="hour-options">
        {Array.from({ length: 24 }, (_, i) => i).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">

        {/* 基本情報 */}
        <div className="space-y-4 pt-2 border-t">
          <h2 className="text-sm font-semibold">基本情報</h2>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>名前 <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="例：アカリ" {...field} />
                </FormControl>
                <FormMessage>{form.formState.errors.name?.message as string}</FormMessage>
              </FormItem>
            )}
          />

          {/* 年齢/誕生日、性別/職業 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-4 md:items-start">

            {/* 年齢 (md: 4カラム) */}
            <div className="md:col-span-4 min-w-0">
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="block">年齢</FormLabel>
                    <FormControl>
                      <div className="space-y-1">
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
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 誕生日 (md: 8カラム) */}
            <div className="md:col-span-8 min-w-0">
              <FormItem className="space-y-2">
                <FormLabel className="block">誕生日</FormLabel>
                <div className="flex items-center gap-2">
                  {/* MM (月) */}
                  <FormField
                    control={form.control}
                    name="birthMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="MM"
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                            }
                            onBlur={field.onBlur}
                            inputMode="numeric"
                            type="text"
                            pattern="^\d{1,2}$"
                            className="w-[80px]"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {/* / テキスト */}
                  <span className="text-lg text-muted-foreground">/</span>
                  {/* DD (日) */}
                  <FormField
                    control={form.control}
                    name="birthDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="DD"
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                            }
                            onBlur={field.onBlur}
                            inputMode="numeric"
                            type="text"
                            pattern="^\d{1,2}$"
                            className="w-[80px]"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                {/* エラーメッセージ (月・日どちらでも表示) */}
                <FormMessage>{form.formState.errors.birthMonth?.message as string}</FormMessage>
                <FormMessage>{form.formState.errors.birthDay?.message as string}</FormMessage>
              </FormItem>
            </div>

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
                      <FormLabel className="block">性別 <span className="text-red-500">*</span></FormLabel>
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

            {/* 職業 (Select + Manual UI) (md: 8カラム) */}
            <div className="md:col-span-8 min-w-0 space-y-3">
              <FormField
                control={form.control}
                name="occupation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block">職業</FormLabel>
                    {/* プリセットロード中は Select を無効化 */}
                    <Select
                      onValueChange={(value) => {
                        if (value === MANUAL_INPUT_KEY) {
                          field.onChange('');
                        } else {
                          field.onChange(value);
                        }
                      }}
                      value={isOccupationManual ? MANUAL_INPUT_KEY : field.value ?? ''}
                      disabled={isLoadingPresets}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingPresets ? "読み込み中..." : "（未選択）"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {managedPresets.occupation.map((preset) => (
                          <SelectItem key={preset.id} value={preset.label}>
                            {preset.label}
                          </SelectItem>
                        ))}
                        <SelectItem value={MANUAL_INPUT_KEY} className="text-blue-600">
                          （手動で入力）
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {isOccupationManual && (
                <div className="space-y-3 pl-2 border-l-2 border-dashed">
                  <FormField
                    control={form.control}
                    name="occupation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-muted-foreground">手動入力</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="例：サラリーマン"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
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
                          プリセットに追加
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
              )}
            </div>
          </div>
        </div>

        {/* 会話 */}
        <div className="space-y-4 pt-2 border-t">
          <h2 className="text-sm font-semibold">会話</h2>

          {/* 一人称 (Select + Manual UI) */}
          <div className="md:col-span-5 min-w-0 space-y-3">
            <FormField
              control={form.control}
              name="firstPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>一人称 <span className="text-red-500">*</span></FormLabel>
                  {/* プリセットロード中は Select を無効化 */}
                  <Select
                    onValueChange={(value) => {
                      if (value === MANUAL_INPUT_KEY) {
                        field.onChange('');
                      } else {
                        field.onChange(value);
                      }
                    }}
                    value={isFirstPersonManual ? MANUAL_INPUT_KEY : field.value ?? ''}
                    disabled={isLoadingPresets}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingPresets ? "読み込み中..." : "（未選択）"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* managedPresets.first_person を使用 */}
                      {managedPresets.first_person.map((preset) => (
                        <SelectItem key={preset.id} value={preset.label}>
                          {preset.label}
                        </SelectItem>
                      ))}
                      <SelectItem value={MANUAL_INPUT_KEY} className="text-blue-600">
                        （手動で入力）
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {isFirstPersonManual && (
              <div className="space-y-3 pl-2 border-l-2 border-dashed">
                <FormField
                  control={form.control}
                  name="firstPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">手動入力</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="例：ウチ"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
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
                        プリセットに追加
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
            )}
          </div>

          {/* 話し方プリセット (Select + Manual UI) */}
          <div className="md:col-sppan-5 min-w-0 space-y-3">
            <FormField
              control={form.control}
              name="speechPreset"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>口調 <span className="text-red-500">*</span></FormLabel>
                  {/* プリセットロード中は Select を無効化 */}
                  <Select
                    onValueChange={(value) => {
                      if (value === MANUAL_INPUT_KEY) {
                        field.onChange('');
                        form.setValue('speechPresetDescription', '');
                        form.setValue('speechPresetExample', '');
                      } else {
                        field.onChange(value);
                        // managedPresets.speech を使用
                        const preset = managedPresets.speech.find(p => p.label === value);
                        form.setValue('speechPresetDescription', preset?.description ?? '');
                        form.setValue('speechPresetExample', preset?.example ?? '');
                      }
                    }}
                    value={isSpeechManual ? MANUAL_INPUT_KEY : field.value ?? ''}
                    disabled={isLoadingPresets}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingPresets ? "読み込み中..." : "（未選択）"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* managedPresets.speech を使用 */}
                      {managedPresets.speech.map((preset) => (
                        <SelectItem key={preset.id} value={preset.label}>
                          {preset.label}
                        </SelectItem>
                      ))}
                      <SelectItem value={MANUAL_INPUT_KEY} className="text-blue-600">
                        （手動で入力）
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {/* 手動入力が選択された時だけ「入力欄」を表示 */}
            {isSpeechManual && (
              <div className="space-y-3 pl-2 border-l-2 border-dashed">
                <FormField
                  control={form.control}
                  name="speechPreset"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="例：子供っぽい"
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="speechPresetDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">特徴</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="例：幼い印象の話し方：「〜だね！」「やったぁ」など"
                          {...field}
                          value={field.value ?? ''}
                          rows={2}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p id="age-help" className="text-xs text-muted-foreground mt-1">
                  「今日はいい感じ」ということを、どのように言いますか？」
                </p>
                <FormField
                  control={form.control}
                  name="speechPresetExample"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">例文</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={speechExamplePlaceholder}
                          {...field}
                          value={field.value ?? ''}
                          rows={2}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isSpeechPresetManaged"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-end space-x-2">
                      <FormLabel className="text-sm text-muted-foreground">
                        プリセットに追加
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
            )}

            {/* プリセット選択中（かつ手動ではない）場合、「特徴の表示」を表示 */}
            {!isSpeechManual && (
              <FormItem>
                <FormLabel className="text-sm text-muted-foreground">説明</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <p className="min-h-[60px] w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                      {form.watch('speechPresetDescription') || '（プリセットを選択すると説明が表示されます）'}
                    </p>
                    <p className="min-h-[60px] w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                      {form.watch('speechPresetExample') || '（例文が設定されていません）'}
                    </p>
                  </div>
                </FormControl>
              </FormItem>
            )}
          </div>

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
        </div>

        {/* 活動傾向 */}
        <div className="space-y-4 pt-2 border-t">
          <h2 className="text-sm font-semibold">睡眠</h2>

          {/* 睡眠スケジュール (Datalist + Suffix に変更) */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="sleepBedtime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>就寝 <span className="text-red-500">*</span></FormLabel> {/* 変更済 */}
                  <FormControl>
                    {/* Input + Suffix */}
                    <div className="flex items-center gap-2">
                      <Input
                        list="hour-options"
                        placeholder="例: 23"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        onBlur={field.onBlur}
                        inputMode="numeric"
                        type="text"
                        pattern="^\d{1,2}$" // 0-23
                        className="w-[120px]"
                      />
                      <span className="text-sm text-muted-foreground">時頃</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sleepWakeTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>起床 <span className="text-red-500">*</span></FormLabel> {/* 変更済 */}
                  <FormControl>
                    {/* Input + Suffix */}
                    <div className="flex items-center gap-2">
                      <Input
                        list="hour-options"
                        placeholder="例: 7"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        onBlur={field.onBlur}
                        inputMode="numeric"
                        type="text"
                        pattern="^\d{1,2}$" // 0-23
                        className="w-[120px]"
                      />
                      <span className="text-sm text-muted-foreground">時頃</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* パーソナリティ */}
        <div className="space-y-2 pt-2 border-t">
          <h2 className="text-sm font-semibold">パーソナリティ</h2>

          {/* 性格 traits */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">性格パラメータ（1〜5で選択）</h3>
            <p id="age-help" className="text-xs text-muted-foreground mt-1">
              数値が高いほどその性格が強い（よく表れる）ことを示します。
            </p>
            {(
              Object.entries(TRAIT_LABELS) as [keyof typeof TRAIT_LABELS, string][]
            ).map(([key, label]) => (
              <FormField
                key={key}
                control={form.control}
                name={`traits.${key}` as const}
                render={({ field }) => (
                  <FormItem>
                    {/* グリッドの分割を 2 (ラベル) : 3 (ボックス) に変更 */}
                    <div className="grid grid-cols-5 items-center gap-3">
                      <FormLabel className="col-span-2 text-sm">{label}</FormLabel>

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
        </div>

        {/* 初期関係設定 */}
        {/* 新規作成時 (IDなし) は表示しない */}
        {otherResidents.length > 0 && (
          <div className="space-y-4 pt-2 border-t">
            <h2 className="text-sm font-semibold">元々の関係の設定</h2>
            <p className="text-xs text-muted-foreground">
              この住人({watchName || '...'})が他の住人と既に持っている関係性を登録します。
            </p>

            {/* 対象の住人を選択するリスト */}
            <div className="space-y-2">
              <Label>相手住人</Label>
              <Select
                value={editingRelationTargetId ?? ''}
                onValueChange={(value) => {
                  setEditingRelationTargetId(value === 'none' ? null : value);
                }}
              >
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="（設定する住人を選択）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">（選択解除）</SelectItem>
                  {otherResidents.map((target) => (
                    <SelectItem key={target.id} value={target.id}>
                      {target.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 選択された場合にのみ設定カードを表示 */}
            {selectedRelationTarget && (() => {
              const target = selectedRelationTarget;
              const currentRel = tempRelations[target.id] ?? DEFAULT_TEMP_RELATION;
              const thisName = watchName || '住人';
              const targetName = target.name;

              return (
                <Card key={target.id} className="mt-4 border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {target.name} との関係
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">

                    {/* 関係性 (Select) */}
                    <div className="space-y-2">
                      <Label>関係性</Label>
                      <Select
                        value={currentRel.relationType}
                        onValueChange={(value: RelationType) =>
                          handleRelationChange(target.id, 'relationType', value)
                        }
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {relationTypeEnum.enumValues.map((type) => (
                            <SelectItem key={type} value={type}>
                              {RELATION_LABELS[type] ?? type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/*  好感度と呼び方を縦二段組にする Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">

                      {/* 左列: 好感度 */}
                      <div className="space-y-6">
                        {/* 自分 -> 相手 */}
                        <div className="space-y-2">
                          <Label htmlFor={`score-to-${target.id}`}>
                            {thisName} → {targetName} の好感度 ({currentRel.feelingScoreTo})
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`score-to-${target.id}`}
                              type="number"
                              min={0} max={100}
                              className="w-16"
                              value={currentRel.feelingScoreTo}
                              onChange={(e) => handleRelationChange(target.id, 'feelingScoreTo', Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                            />
                            <Slider
                              value={[currentRel.feelingScoreTo]}
                              onValueChange={([value]) => handleRelationChange(target.id, 'feelingScoreTo', value)}
                              min={0} max={100} step={1}
                            />
                          </div>
                        </div>

                        {/* 相手 -> 自分 */}
                        <div className="space-y-2">
                          <Label htmlFor={`score-from-${target.id}`}>
                            {targetName} → {thisName} の好感度 ({currentRel.feelingScoreFrom})
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`score-from-${target.id}`}
                              type="number"
                              min={0} max={100}
                              className="w-16"
                              value={currentRel.feelingScoreFrom}
                              onChange={(e) => handleRelationChange(target.id, 'feelingScoreFrom', Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                            />
                            <Slider
                              value={[currentRel.feelingScoreFrom]}
                              onValueChange={([value]) => handleRelationChange(target.id, 'feelingScoreFrom', value)}
                              min={0} max={100} step={1}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 右列: 呼び方 */}
                      <div className="space-y-6">
                        {/* 自分 -> 相手 */}
                        <div className="space-y-2">
                          <Label htmlFor={`nick-to-${target.id}`}>
                            呼び方　{thisName} → {targetName}
                          </Label>
                          <Input
                            id={`nick-to-${target.id}`}
                            placeholder={`例: ${targetName}さん`}
                            value={currentRel.nicknameTo}
                            onChange={(e) =>
                              handleRelationChange(target.id, 'nicknameTo', e.target.value)
                            }
                          />
                        </div>

                        {/* 相手 -> 自分 */}
                        <div className="space-y-2">
                          <Label htmlFor={`nick-from-${target.id}`}>
                            呼び方　{targetName} → {thisName}
                          </Label>
                          <Input
                            id={`nick-from-${target.id}`}
                            placeholder={`例: ${thisName}さん`}
                            value={currentRel.nicknameFrom}
                            onChange={(e) =>
                              handleRelationChange(target.id, 'nicknameFrom', e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        )}

        <div className="flex justify-end gap-2">
          {/* プリセット保存中もボタンを無効化 */}
          <Button type="submit" disabled={upsert.isPending || upsertPreset.isPending}>
            {upsert.isPending ? '保存中…' : '保存'}
          </Button>
        </div>

      </form>

      {/* 診断パネル (MBTI診断) */}
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
