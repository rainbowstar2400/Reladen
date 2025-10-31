'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Resident } from '@/types';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useUpsertResident } from '@/lib/data/residents';
import { useMemo } from 'react';

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
  const upsert = useUpsertResident();

  async function handleSubmit(values: ResidentFormValues) {
    const normalizedMbti: (typeof MBTI_TYPES)[number] | undefined =
      values.mbti && values.mbti.trim().length > 0
        ? (values.mbti as (typeof MBTI_TYPES)[number])
        : undefined;

    const saved = await upsert.mutateAsync({
      ...values,
      mbti: normalizedMbti,
      // traits は既にオブジェクト
      traits: values.traits,
      // trustToPlayer は表示専用だが、サーバ側に既定があるならここで送らなくてもOK
    });
  
    form.reset({
      id: saved.id,
      name: saved.name,
      mbti: saved.mbti ?? '',
      traits: saved.traits ?? { ...DEFAULT_TRAITS },
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
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>MBTI</FormLabel>
              <FormControl>
                <Input placeholder="例：INFP" {...field} value={field.value ?? ''} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="speechPreset"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>話し方プリセット</FormLabel>
              <FormControl>
                <select className="w-full rounded border px-3 py-2" {...field}>
                  <option value="">（未設定）</option>
                  {SPEECH_PRESETS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
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
          <Button type="submit" disabled={upsert.isPending}>
            {upsert.isPending ? '保存中…' : '保存'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
