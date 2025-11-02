// apps/web/components/notifications/NotificationsPanel.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications, useMarkNotificationRead, fetchEventById } from '@/lib/data/notifications';
import type { NotificationRecord } from '@repo/shared/types/conversation';

export default function NotificationsPanel() {
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const router = useRouter();

  async function openNotification(n: NotificationRecord) {
    // 対応するイベント（会話）を取得して存在確認
    const ev = await fetchEventById(n.linkedEventId);
    if (!ev) return;

    // 既読化
    if (n.status !== 'read') {
      markRead.mutate(n.id);
    }

    // URLに ?log=<eventId> を付ける → 既存の detail-layer が拾ってダイアログ表示
    const url = new URL(window.location.href);
    url.searchParams.set('log', ev.id);
    router.push(url.pathname + '?' + url.searchParams.toString());
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-white p-4 text-sm text-gray-500">
        お知らせを読み込み中…
      </div>
    );
  }

  const unread = notifications.filter(n => n.status === 'unread').length;

  return (
    <div className="rounded-2xl border bg-white">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="font-semibold">お知らせ</div>
        <div className="text-xs text-gray-500">未読 {unread} 件</div>
      </div>

      <ul className="divide-y">
        {notifications.length === 0 && (
          <li className="px-4 py-6 text-sm text-gray-500">現在お知らせはありません。</li>
        )}

        {notifications.map((n) => (
          <li key={n.id} className="px-4 py-3 hover:bg-gray-50 transition">
            <button
              onClick={() => openNotification(n)}
              className="w-full flex items-start gap-3 text-left"
            >
              <span
                className={`mt-1 h-2 w-2 rounded-full ${
                  n.status === 'unread' ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
              <span className="flex-1">
                <div className="text-sm">
                  {n.type === 'conversation' ? '会話が発生しました' : 'お知らせ'}
                </div>
                {n.snippet && (
                  <div className="text-xs text-gray-500 line-clamp-1">{n.snippet}</div>
                )}
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {new Date(n.occurredAt).toLocaleString()}
                </div>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
