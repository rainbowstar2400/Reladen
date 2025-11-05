'use client';

import { useQuery } from '@tanstack/react-query';
import { getUnreadCount, listNotifications, markAsRead } from '@/lib/data/notifications';
import { Bell } from 'lucide-react';
import { useState, useMemo } from 'react';
import ConversationLogModal from '../logs/ConversationLogModal';

export default function NotificationsBell() {
  const [openEventId, setOpenEventId] = useState<string | null>(null);

  const { data: unread = 0, refetch: refetchUnread } = useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: getUnreadCount,
    refetchInterval: 15_000,
  });

  const { data: items = [], refetch: refetchList } = useQuery({
    queryKey: ['notifications', 'list', { limit: 10 }],
    queryFn: () => listNotifications({ limit: 10 }),
    refetchInterval: 15_000,
  });

  const top = useMemo(() => items.slice(0, 5), [items]);

  const onOpen = async (eventId: string, notificationId?: string) => {
    setOpenEventId(eventId);
    if (notificationId) {
      await markAsRead(notificationId);
      await Promise.all([refetchUnread(), refetchList()]);
    }
  };

  return (
    <>
      <button
        className="relative inline-flex items-center justify-center size-9 rounded-full hover:bg-muted transition"
        aria-label="通知"
        title="通知"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
        {/* ドロップダウン風の簡易リスト（必要ならポップオーバーに置換） */}
        <div className="absolute right-0 top-10 w-80 max-h-96 overflow-auto rounded-2xl bg-popover shadow p-2 hidden group-hover:block">
          {top.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">新しい通知はありません</div>
          ) : (
            top.map((n) => (
              <button
                key={n.id}
                onClick={() => onOpen(n.linkedEventId, n.id)}
                className="w-full text-left p-3 rounded-xl hover:bg-muted transition"
              >
                <div className="text-xs text-muted-foreground">
                  {new Date(n.occurredAt).toLocaleString()}
                </div>
                <div className="text-sm font-medium">{n.snippet ?? '会話が発生しました'}</div>
                {n.status === 'unread' && (
                  <span className="mt-1 inline-block text-[10px] text-blue-600">未読</span>
                )}
              </button>
            ))
          )}
        </div>
      </button>

      {/* ログモーダル */}
      <ConversationLogModal
        open={!!openEventId}
        eventId={openEventId ?? undefined}
        onOpenChange={(v) => setOpenEventId(v ? openEventId : null)}
        onDidClose={async () => {
          setOpenEventId(null);
          await Promise.all([refetchUnread(), refetchList()]);
        }}
      />
    </>
  );
}
