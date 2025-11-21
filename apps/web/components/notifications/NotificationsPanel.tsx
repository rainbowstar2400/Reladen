// apps/web/components/notifications/NotificationsPanel.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  useNotifications,
  useMarkNotificationRead,
  fetchEventById,
} from '@/lib/data/notifications';
import { useResidentNameMap } from '@/lib/data/residents';
import type { NotificationRecord } from '@repo/shared/types/conversation';

export default function NotificationsPanel() {
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const router = useRouter();
  const [formattedDates, setFormattedDates] = React.useState<Record<string, string>>({});
  const residentNameMap = useResidentNameMap();

  React.useEffect(() => {
    const map: Record<string, string> = {};
    notifications.forEach((n) => {
      // 発生日時は ISO 文字列として保存されている
      map[n.id] = new Date(n.occurredAt).toLocaleString();
    });
    setFormattedDates(map);
  }, [notifications]);

  async function openNotification(n: NotificationRecord) {
    try {
      // 既読化（未読のみ）
      if (n.status !== 'read') {
        markRead.mutate(n.id);
      }

      // kind を決定（type がなければ payload.kind を参照）
      const kind =
        (n as any).type ??
        (n as any)?.payload?.kind ??
        'conversation';

      // --- 相談: /?consult=<consultId> へ ---
      if (kind === 'consult') {
        const consultId =
          (n as any).linkedConsultId ??
          (n as any)?.payload?.consultId ??
          (n as any)?.consultId;

        if (consultId) {
          const url = new URL(window.location.href);
          url.searchParams.set('consult', String(consultId));
          url.searchParams.delete('log'); // 競合しないよう除去
          router.push(url.pathname + '?' + url.searchParams.toString(), { scroll: false });
        }
        return;
      }

      // --- 既定: 会話（ログ）: /reports?log=<eventId> 相当（現実装はトップで ?log= を拾う想定） ---
      const eventId =
        n.linkedEventId ??
        (n as any)?.payload?.eventId ??
        (n as any)?.eventId;

      if (eventId) {
        // 存在確認してローカルに取り込む（既存の挙動を維持）
        const ev = await fetchEventById(eventId);
        if (!ev) return;

        const url = new URL(window.location.href);
        url.searchParams.set('log', ev.id);
        url.searchParams.delete('consult'); // 競合しないよう除去
        router.push(url.pathname + '?' + url.searchParams.toString(), { scroll: false });
      }
    } catch (e) {
      // 必要に応じてトーストなど
      // console.warn(e);
    }
  }

  const unread = notifications.filter((n) => n.status === 'unread').length;

  return (
    <div className="rounded-2xl border bg-white">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="font-semibold">お知らせ</div>
        <div className="text-xs text-gray-500">未読 {unread} 件</div>
      </div>

      <ul className="divide-y">

        {/* 読み込み中の表示 */}
        {isLoading && (
          <li className="px-4 py-3 text-sm text-gray-500">お知らせを読み込み中…</li>
        )}

        {notifications.length === 0 && !isLoading && (
          <li className="px-4 py-6 text-sm text-gray-500">現在お知らせはありません。</li>
        )}

        {notifications.map((n) => (
          <li key={n.id} className="px-4 py-3 hover:bg-gray-50 transition">
            <button
              onClick={() => openNotification(n)}
              className="w-full flex items-start gap-3 text-left"
              aria-label={n.snippet ?? 'お知らせを開く'}
            >
              {/* 未読ドット（お知らせ単位） */}
              <span
                className={`mt-1 h-2 w-2 rounded-full ${n.status === 'unread' ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
              />

              <span className="flex-1">
                <div className="text-sm">
                  {n.type === 'conversation' ? '会話が発生しました' : 'お知らせ'}
                </div>

                {n.snippet && (
                  <div className="text-xs text-gray-500 line-clamp-1">{n.snippet}</div>
                )}

                {/* 日時は事前フォーマットを使用 */}
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {formattedDates[n.id] ?? ''}
                </div>

                {/* 参加者があれば軽く補助情報 */}
                {Array.isArray(n.participants) && n.participants.length === 2 && (
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {residentNameMap[n.participants[0]] ?? n.participants[0]} ↔{' '}
                    {residentNameMap[n.participants[1]] ?? n.participants[1]}
                  </div>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
