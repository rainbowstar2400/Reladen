'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Resident } from '@/types';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useUpsertResident } from '@/lib/data/residents';
import { useMemo, useState, useEffect } from 'react';
import { QUESTIONS, calculateMbti, type Answer } from 'packages/shared/logic/mbti.ts';
import { useRouter } from 'next/navigation';

// === フォーム内で使う選択肢（まずは固定配列で運用） ===
const MBTI_TYPES = [
  'INTJ','INTP','ENTJ','ENTP',
  'INFJ','INFP','ENFJ','ENFP',
  'ISTJ','ISFJ','ESTJ','ESFJ',
  'ISTP','ISFP','ESTP','ESFP',
] as const;

const SPEECH_PRESETS = [
  { value: 'polite', label: 'ていねい' },
  { value: 'casual', label: 'くだけた' },
  { value: 'blunt',  label: '素っ気ない' },
  { value: 'soft',   label: 'やわらかい' },
] as const;

// traits の初期値（未設定でも落ちないように）
const DEFAULT_TRAITS = {
  sociability: 3,    // 社交性
  empathy: 3,        // 気配り
  stubbornness: 3,   // 頑固さ
  activity: 3,       // 行動力
  expressiveness: 3, // 表現力
} as const;

const traitsPlaceholder = '{"likes": ["カフェ"], "hobby": "散歩"}';

const residentFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, '名前は必須です'),
  // MBTIはいったん自由文字列で許容（セレクト側で範囲を絞る）
  mbti: z.string().optional().nullable(),
  // JSONではなく、5項目の数値スライダー（1〜5）
  traits: z.object({
    sociability:    z.number().int().min(1).max(5),
    empathy:        z.number().int().min(1).max(5),
    stubbornness:   z.number().int().min(1).max(5),
    activity:       z.number().int().min(1).max(5),
    expressiveness: z.number().int().min(1).max(5),
  }),
  // 追加：話し方プリセット（未設定可）
  speechPreset: z.string().optional().nullable(),
  // 追加：プレイヤーへの信頼度（表示専用）
  trustToPlayer: z.number().min(0).max(100).optional(),
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
        name: '',
        mbti: '',
        speechPreset: defaultValues?.speechPreset ?? '',
        trustToPlayer: defaultValues?.trustToPlayer ?? 50,
        traits: traitsObj,
        ...defaultValues, // ↑上書きできるように最後でもOK
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
  
    // ↑ 正規化済みの値だけを使って payload を明示的に組む（...values は使わない）
    const payload = {
      id: values.id,
      name: values.name,
      mbti: normalizedMbti,
      traits: values.traits,                 // 既にオブジェクト
      ...(normalizedSpeech !== undefined ? { speechPreset: normalizedSpeech } : {}),
      // trustToPlayer は表示専用なので送らなくてOK（サーバ側で既定が入る想定）
    };
  
    const saved = await upsert.mutateAsync(payload);
  
    form.reset({
      id: saved.id,
      name: saved.name,
      mbti: saved.mbti ?? '',
      traits: saved.traits ?? { sociability: 3, empathy: 3, stubbornness: 3, activity: 3, expressiveness: 3 },
      speechPreset: saved.speechPreset ?? '',
      trustToPlayer: saved.trustToPlayer ?? 50,
    });
  
    onSubmitted?.();
  }

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
        <FormField
          control={form.control}
          name="mbti"
          render={({ field }) => {
            const v = field.value ?? ''; // null/undefined→空文字
            return (
              <FormItem className="space-y-2">
                <FormLabel>MBTI</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <select
                      className="w-full rounded border px-3 py-2"
                      name={field.name}
                      ref={field.ref}
                      value={v}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                    >
                      <option value="">（未設定）</option>
                      {[
                        'INTJ','INTP','ENTJ','ENTP',
                        'INFJ','INFP','ENFJ','ENFP',
                        'ISTJ','ISFJ','ESTJ','ESFJ',
                        'ISTP','ISFP','ESTP','ESFP',
                      ].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
        
                    {/* ← これが診断パネルのトグル */}
                    <Button type="button" variant="secondary" onClick={() => setShowDiagnosis(true)}>
                      診断
                    </Button>
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
            { key: 'sociability',    label: '社交性' },
            { key: 'empathy',        label: '気配り' },
            { key: 'stubbornness',   label: '頑固さ' },
            { key: 'activity',       label: '行動力' },
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
        <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">プレイヤーへの信頼度</span>
          <span className="text-sm tabular-nums">
            {(form.getValues('trustToPlayer') ?? 50)}/100
          </span>
        </div>
        <div className="h-2 w-full rounded bg-muted">
          <div
            className="h-2 rounded bg-foreground/70"
            style={{ width: `${(form.getValues('trustToPlayer') ?? 50)}%` }}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push('/residents/diagnosis')}
        >
          MBTIを診断する
        </Button>
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
