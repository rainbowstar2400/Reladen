'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Resident } from '@reladen/types';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useUpsertResident } from '@/lib/data/residents';
import { useMemo } from 'react';

const traitsPlaceholder = '{"likes": ["カフェ"], "hobby": "散歩"}';

const residentFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, '名前は必須です'),
  mbti: z.string().optional().nullable(),
  traits: z.string().optional().nullable(),
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
      const traitsValue =
        typeof defaultValues?.traits === 'object' && defaultValues?.traits !== null
          ? JSON.stringify(defaultValues.traits, null, 2)
          : (defaultValues?.traits as any) ?? '';
      return {
        name: '',
        mbti: '',
        ...defaultValues,
        traits: traitsValue,
      };
    }, [defaultValues]),
  });
  const upsert = useUpsertResident();

  async function handleSubmit(values: ResidentFormValues) {
    let parsedTraits = values.traits;
    if (typeof values.traits === 'string' && values.traits.trim().length > 0) {
      try {
        parsedTraits = JSON.parse(values.traits);
      } catch (error) {
        form.setError('traits', { message: 'JSONの形式が正しくありません' });
        return;
      }
    }
    const normalizedMbti = values.mbti && values.mbti.trim().length > 0 ? values.mbti : null;
    const saved = await upsert.mutateAsync({
      ...values,
      mbti: normalizedMbti ?? null,
      traits: parsedTraits ?? null,
    });
    form.reset({
      id: saved.id,
      name: saved.name,
      mbti: saved.mbti ?? '',
      traits:
        saved?.traits && typeof saved.traits === 'object'
          ? JSON.stringify(saved.traits, null, 2)
          : (saved as any)?.traits ?? '',
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
                <Input placeholder="例：INFP" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="traits"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>特徴(JSON)</FormLabel>
              <FormControl>
                <Textarea placeholder={traitsPlaceholder} {...field} />
              </FormControl>
              <FormMessage>{form.formState.errors.traits?.message as string}</FormMessage>
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={upsert.isPending}>
            {upsert.isPending ? '保存中…' : '保存'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
