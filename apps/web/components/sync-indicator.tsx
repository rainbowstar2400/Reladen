'use client';

import { cn } from '@/lib/utils';
import { useSync } from '@/lib/sync/use-sync';
import { Loader2, WifiOff, Wifi, AlertTriangle } from 'lucide-react';

const LABELS = {
  offline: 'オフライン',
  online: '同期済み',
  syncing: '同期中…',
  error: '同期エラー',
} as const;

export function SyncIndicator() {
  const { phase } = useSync();

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
        phase === 'offline' && 'text-muted-foreground',
        phase === 'syncing' && 'text-primary',
        phase === 'error' && 'text-destructive'
      )}
    >
      {phase === 'syncing' && <Loader2 className="h-3 w-3 animate-spin" />}
      {phase === 'offline' && <WifiOff className="h-3 w-3" />}
      {phase === 'online' && <Wifi className="h-3 w-3" />}
      {phase === 'error' && <AlertTriangle className="h-3 w-3" />}
      <span>{LABELS[phase]}</span>
    </div>
  );
}
