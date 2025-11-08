'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QUESTIONS, calculateMbti, Answer } from '@/../../packages/shared/logic/mbti';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// 住人に結果を保存する API/ドメイン呼び出し（既存の upsert パスに合わせて調整）
import { useUpsertResident } from '@/lib/data/residents';

export default function Page() {
  const router = useRouter();
  const upsert = useUpsertResident();

  // 画面遷移で id がある前提 or 選択式にする？
  // ここでは簡易に「名前だけ指定→新規作成 or 更新」とする例
  const [name, setName] = useState('');
  const [scores, setScores] = useState<Record<string, number>>(
    () => Object.fromEntries(QUESTIONS.map(q => [q.id, 3])) // デフォルト3
  );
  const [saving, setSaving] = useState(false);
  const answers: Answer[] = useMemo(
    () => Object.entries(scores).map(([id, score]) => ({ id, score })),
    [scores]
  );

  const onChangeScore = (id: string, value: number) => {
    setScores(prev => ({ ...prev, [id]: value }));
  };

  const onDiagnose = async () => {
    const mbti = calculateMbti(answers);
    setSaving(true);
    try {
      await upsert.mutateAsync({
        name: name.trim(),
        mbti,                         // ← ここが今回の主目的
        // traits/speechPreset は既存フォームで編集
      });
      router.push('/residents');      // 一覧へ戻るなど
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">MBTI 診断</h1>

      <div className="space-y-2">
        <label className="text-sm font-medium">住人の名前（保存先）</label>
        <Input
          placeholder="例：山田 花子"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {QUESTIONS.map(q => (
          <div key={q.id} className="grid grid-cols-5 items-center gap-3">
            <div className="col-span-3 text-sm">{q.text}</div>
            <input
              className="col-span-1 w-full"
              type="range"
              min={1}
              max={5}
              step={1}
              value={scores[q.id]}
              onChange={e => onChangeScore(q.id, Number(e.target.value))}
            />
            <div className="col-span-1 text-right text-sm tabular-nums">{scores[q.id]}</div>
          </div>
        ))}
      </div>

      <div className="pt-2">
        <Button onClick={onDiagnose} disabled={saving || !name.trim()}>
          {saving ? '保存中…' : '診断して保存'}
        </Button>
      </div>
    </div>
  );
}
