'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createConversationEvent } from '@/lib/repos/conversation-repo';
import type { ConversationPayloadStrict } from '@/lib/repos/conversation-repo';
import { putLocal, listLocal, removeLocal } from '@/lib/db-local';
import { newId } from '@/lib/newId';
import type { NotificationRecord, EventLogStrict } from '@repo/shared/types/conversation';

type SeedMessage = { kind: 'info' | 'error'; text: string } | null;

function buildConversationPayload(): ConversationPayloadStrict {
  return {
    threadId: `thread-${newId()}`,
    participants: ['A', 'B'],
    lines: [
      { speaker: 'A', text: '今日はいい天気だね。' },
      { speaker: 'B', text: 'うん、散歩日和。' },
    ],
    meta: {
      tags: ['demo'],
      newKnowledge: [],
    },
    deltas: {
      aToB: { favor: 1, impression: 'like' },
      bToA: { favor: 0, impression: 'curious' },
    },
    systemLine: 'A と B が話している。',
  };
}

function buildConsultEvent(now: string): EventLogStrict {
  return {
    id: newId(),
    kind: 'consult',
    updated_at: now,
    deleted: false,
    payload: {
      title: '相談',
      content: '最近眠れなくて困っています。',
      choices: [
        { id: 'c1', label: '温かい飲み物を試してみる' },
        { id: 'c2', label: '少し散歩してみる' },
        { id: 'c3', label: '今日は早めに休む' },
      ],
      occurredAt: now,
      participants: ['A'],
    },
  };
}

function buildConsultNotification(consultId: string, now: string): NotificationRecord & { deleted: boolean } {
  return {
    id: newId(),
    type: 'consult',
    linkedConsultId: consultId,
    participants: ['A'],
    snippet: '相談が届いています',
    occurredAt: now,
    status: 'unread',
    priority: 0,
    updated_at: now,
    deleted: false,
  };
}

export default function SeedNotificationsPage() {
  const [message, setMessage] = useState<SeedMessage>(null);
  const [count, setCount] = useState(2);

  const seedConversations = async () => {
    try {
      for (let i = 0; i < Math.max(1, count); i += 1) {
        await createConversationEvent(buildConversationPayload());
      }
      setMessage({ kind: 'info', text: '会話通知を追加しました。' });
    } catch (e) {
      setMessage({ kind: 'error', text: '会話通知の追加に失敗しました。' });
    }
  };

  const seedConsults = async () => {
    try {
      for (let i = 0; i < Math.max(1, count); i += 1) {
        const now = new Date().toISOString();
        const ev = buildConsultEvent(now);
        await putLocal('events', ev as any);
        const notif = buildConsultNotification(ev.id, now);
        await putLocal('notifications', notif as any);
      }
      setMessage({ kind: 'info', text: '相談通知を追加しました。' });
    } catch (e) {
      setMessage({ kind: 'error', text: '相談通知の追加に失敗しました。' });
    }
  };

  const clearTable = async (table: 'notifications' | 'events') => {
    const items = await listLocal<any>(table);
    await Promise.all(items.map((item) => removeLocal(table, item.id)));
  };

  const clearNotifications = async () => {
    try {
      await clearTable('notifications');
      setMessage({ kind: 'info', text: '通知を削除しました。' });
    } catch {
      setMessage({ kind: 'error', text: '通知の削除に失敗しました。' });
    }
  };

  const clearEvents = async () => {
    try {
      await clearTable('events');
      setMessage({ kind: 'info', text: 'イベントを削除しました。' });
    } catch {
      setMessage({ kind: 'error', text: 'イベントの削除に失敗しました。' });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">通知ダミー作成</h1>
        <p className="text-sm text-muted-foreground">
          Home の会話/相談通知を確認するための開発用ページです。
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground">追加数</label>
        <input
          type="number"
          min={1}
          max={10}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="h-9 w-20 rounded-md border bg-background px-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={seedConversations}>会話通知を追加</Button>
        <Button onClick={seedConsults} variant="secondary">
          相談通知を追加
        </Button>
        <Button onClick={clearNotifications} variant="outline">
          通知を削除
        </Button>
        <Button onClick={clearEvents} variant="outline">
          イベントを削除
        </Button>
      </div>

      <div className="rounded-lg border p-4 text-sm">
        <div className="font-medium">注意</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>相談詳細の実体は Supabase の consult イベントに依存します。</li>
          <li>ここで作る相談通知は「通知の表示確認」目的です。</li>
        </ul>
      </div>

      {message && (
        <div
          className={
            'rounded-lg border px-4 py-2 text-sm ' +
            (message.kind === 'error' ? 'border-red-300 text-red-600' : 'border-emerald-300 text-emerald-700')
          }
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
