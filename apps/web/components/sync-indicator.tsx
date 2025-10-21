'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSync } from '@/lib/sync/use-sync';
import { Loader2 } from 'lucide-react';

const LABELS = {
  offline: 'オフライン',
  online: '同期済み',
  syncing: '同期中…',
  error: '同期エラー',
} as const;

const STATUS_COLORS = {
  offline: 'bg-muted-foreground',
  online: 'bg-emerald-500',
  syncing: 'bg-primary',
  error: 'bg-destructive',
} as const;

const TEXT_COLORS = {
  offline: 'text-muted-foreground',
  online: 'text-emerald-600 dark:text-emerald-400',
  syncing: 'text-primary',
  error: 'text-destructive',
} as const;

export function SyncIndicator() {
  const { phase, sync } = useSync();
  const [isPending, setIsPending] = useState(false);

  const handleSync = async () => {
    if (isPending) return;
    setIsPending(true);
    const result = await sync();
    setIsPending(false);

    if (result.ok) {
      toast.success('同期が完了しました');
      return;
    }

    if (result.reason === 'offline') {
      toast.warning('オフラインのため同期できません');
      return;
    }

    toast.error(result.message ? `同期に失敗しました: ${result.message}` : '同期に失敗しました');
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
          TEXT_COLORS[phase]
        )}
      >
        <span
          aria-hidden
          className={cn(
            'h-2 w-2 rounded-full',
            STATUS_COLORS[phase],
            phase === 'syncing' && 'animate-pulse'
          )}
        />
        <span>{LABELS[phase]}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={isPending || phase === 'syncing'}
        className="flex items-center gap-1"
      >
        {(isPending || phase === 'syncing') && <Loader2 className="h-3 w-3 animate-spin" />}
        <span>↻ 同期</span>
      </Button>
    </div>
  );
}
