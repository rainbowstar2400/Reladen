'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useResidents } from '@/lib/data/residents';
import { useDeskTransition } from '@/components/room/room-transition-context';

export function OfficeContent() {
  const router = useRouter();
  const deskTransition = useDeskTransition();
  const { data, isLoading } = useResidents();
  const count = isLoading ? '—' : (data?.length ?? 0);

  const Btn = ({ href, label }: { href: string; label: string }) => (
    <Button asChild variant="outline" className="h-16 w-full rounded-2xl text-lg">
      <Link href={href}>{label}</Link>
    </Button>
  );

  const SubBtn = ({ href, label }: { href: string; label: string }) => (
    <Button asChild variant="outline" className="h-12 w-full rounded-xl text-base">
      <Link href={href}>{label}</Link>
    </Button>
  );

  const navigateDesk = (href: string, target: 'home' | 'desk') => {
    const delay = deskTransition?.beginDeskTransition(target) ?? 0;
    window.setTimeout(() => {
      router.push(href);
    }, delay);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="outline"
          className="h-10 rounded-xl text-sm"
          onClick={() => navigateDesk('/home', 'home')}
        >
          ホームに戻る
        </Button>
        <Button
          variant="outline"
          className="h-10 rounded-xl text-sm"
          onClick={() => navigateDesk('/reports', 'desk')}
        >
          日報へ
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">管理室</h1>
        <p className="text-sm">
          現在の総住人数：<span className="tabular-nums text-base font-semibold">{count}</span> 人
        </p>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">住人管理</h2>
          <div className="flex flex-col gap-6">
            <Btn href="/office/residents" label="住人一覧" />
            <Btn href="/office/new" label="新規住人登録" />
            <Btn href="/office/presets" label="プリセット管理" />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">管理室メニュー</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <SubBtn href="/settings" label="設定" />
            <SubBtn href="/playguide" label="遊び方" />
            <SubBtn href="/specs" label="仕様について" />
          </div>
        </div>
      </div>
    </div>
  );
}
