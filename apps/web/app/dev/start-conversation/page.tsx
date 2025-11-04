'use client';

import { useState } from 'react';
import { startConversation } from '@/app/actions/conversation';
import RealtimeSubscriber from '@/components/Realtime/RealtimeSubscriber';

export default function StartConversationDev() {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setLast(null);
    try {
      const res = await startConversation({
        threadId: 'demo-thread',
        participants: ['1111', '2222'],
        topic: 'お昼の予定',
        hints: { tone: 'casual', maxLines: 6 },
      });
      if (res.ok) {
        setLast(res.eventId);
        alert('会話を生成し、通知を作成しました。ダッシュボードのお知らせから開けます。');
      } else {
        alert(`失敗: ${res.reason}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <RealtimeSubscriber />
      <button
        className="rounded-xl border px-4 py-2 shadow disabled:opacity-50"
        onClick={onClick}
        disabled={busy}
      >
        会話生成（サーバアクション）
      </button>
      {last && <div className="text-sm text-muted-foreground">eventId: {last}</div>}
    </div>
  );
}
