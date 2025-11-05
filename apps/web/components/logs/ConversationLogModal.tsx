'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadConversationEventById } from '@/lib/repos/conversation-repo';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  eventId?: string;
  onOpenChange?: (open: boolean) => void;
  onDidClose?: () => void;
};

export default function ConversationLogModal(props: Props) {
  const { open, eventId, onOpenChange, onDidClose } = props;
  const { data, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => (eventId ? loadConversationEventById(eventId) : Promise.resolve(null)),
    enabled: open && !!eventId,
  });

  const [playedIndex, setPlayedIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setPlayedIndex(0);
      return;
    }
    if (!data?.payload?.lines) return;

    // typing風に1行ずつ再生
    setPlayedIndex(0);
    let i = 0;
    const lines: Array<{ speaker: string; text: string }> = data.payload.lines;
    const timer = setInterval(() => {
      i += 1;
      setPlayedIndex(Math.min(i, lines.length));
      if (i >= lines.length) clearInterval(timer);
    }, 450);
    return () => clearInterval(timer);
  }, [open, data]);

  const visibleLines = useMemo(() => {
    const lines: Array<{ speaker: string; text: string }> = data?.payload?.lines ?? [];
    return lines.slice(0, playedIndex);
  }, [data, playedIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40">
      <div className="w-[min(92vw,800px)] max-h-[80vh] overflow-auto rounded-2xl bg-background shadow-lg border">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="text-sm text-muted-foreground">
            {data ? new Date(data.updated_at).toLocaleString() : '読み込み中…'}
          </div>
          <button
            className="p-1 rounded hover:bg-muted"
            onClick={() => {
              onOpenChange?.(false);
              onDidClose?.();
            }}
            aria-label="閉じる"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {isLoading && <div className="text-sm text-muted-foreground">読み込み中…</div>}

          {visibleLines.map((l, idx) => (
            <div key={idx} className="flex gap-2">
              <div className="shrink-0 font-mono text-xs text-muted-foreground w-16 text-right">
                {l.speaker}
              </div>
              <div className="rounded-2xl px-3 py-2 bg-muted/50">{l.text}</div>
            </div>
          ))}

          {/* SYSTEM 行（評価結果サマリ） */}
          {data?.payload?.systemLine && (
            <div className="mt-3 text-xs text-muted-foreground border-t pt-3">
              {data.payload.systemLine}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
