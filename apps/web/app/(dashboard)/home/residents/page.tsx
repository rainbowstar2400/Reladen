'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useResidents } from '@/lib/data/residents';
import { Loader2 } from 'lucide-react';

export default function HomeResidentsPage() {
  const { data: residents = [], isLoading } = useResidents();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">みんなの様子</h1>
        <Button variant="outline" asChild>
          <Link href="/home">ホームへ戻る</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          読み込み中…
        </div>
      ) : residents.length === 0 ? (
        <p className="text-sm text-muted-foreground">住人がいません。</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {residents.map((resident) => (
            <div
              key={resident.id}
              className="rounded-2xl border bg-background p-4 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="h-2 w-2 rounded-full bg-amber-300" />
                <span className="h-2 w-2 rounded-full bg-rose-300" />
                <span className="text-xs text-muted-foreground">窓</span>
              </div>
              <div className="space-y-3">
                <div className="text-lg font-semibold">{resident.name ?? '（名前未設定）'}</div>
                <Button size="sm" asChild>
                  <Link href={`/office/residents/${resident.id}`}>覗く</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
