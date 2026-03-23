import { describe, expect, it } from 'vitest';
import type { NotificationRecord } from '@repo/shared/types/conversation';
import {
  filterExpiredUnansweredConsultNotifications,
  filterNotificationsByRecency,
  isExpiredUnansweredConsultPayload,
} from '@/lib/data/notification-visibility';

const NOW_ISO = '2026-03-21T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

function hoursAgo(hours: number): string {
  return new Date(NOW_MS - hours * 60 * 60 * 1000).toISOString();
}

function makeNotification(params: Partial<NotificationRecord> & Pick<NotificationRecord, 'id'>): NotificationRecord {
  return {
    id: params.id,
    type: params.type ?? 'conversation',
    linkedEventId: params.linkedEventId ?? '11111111-1111-4111-8111-111111111111',
    threadId: params.threadId,
    participants: params.participants,
    snippet: params.snippet,
    occurredAt: params.occurredAt ?? NOW_ISO,
    status: params.status ?? 'unread',
    priority: params.priority ?? 0,
    updated_at: params.updated_at ?? NOW_ISO,
  };
}

describe('notification-visibility', () => {
  it('既読/未読の時間窓で通知を絞り込む', () => {
    const notifications: NotificationRecord[] = [
      makeNotification({ id: 'n1', status: 'read', occurredAt: hoursAgo(4) }),
      makeNotification({ id: 'n2', status: 'read', occurredAt: hoursAgo(6) }),
      makeNotification({ id: 'n3', status: 'unread', occurredAt: hoursAgo(9) }),
      makeNotification({ id: 'n4', status: 'unread', occurredAt: hoursAgo(11) }),
    ];

    const visible = filterNotificationsByRecency(notifications, NOW_MS);

    expect(visible.map((item) => item.id)).toEqual(['n1', 'n3']);
  });

  it('期限切れかつ未回答の consult payload を期限切れと判定する', () => {
    expect(
      isExpiredUnansweredConsultPayload(
        { expiresAt: hoursAgo(1), selectedChoiceId: null },
        NOW_MS,
      ),
    ).toBe(true);
    expect(
      isExpiredUnansweredConsultPayload(
        { expiresAt: hoursAgo(1), selectedChoiceId: 'choice_1' },
        NOW_MS,
      ),
    ).toBe(false);
    expect(
      isExpiredUnansweredConsultPayload(
        { expiresAt: new Date(NOW_MS + 60 * 60 * 1000).toISOString(), selectedChoiceId: null },
        NOW_MS,
      ),
    ).toBe(false);
  });

  it('consult 通知は期限切れ未回答のみ除外する', () => {
    const consultExpired = makeNotification({
      id: 'c1',
      type: 'consult',
      linkedEventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    const consultAnswered = makeNotification({
      id: 'c2',
      type: 'consult',
      linkedEventId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });
    const consultMissingPayload = makeNotification({
      id: 'c3',
      type: 'consult',
      linkedEventId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    const conversation = makeNotification({ id: 'n1', type: 'conversation' });

    const payloadByEventId = new Map<string, { expiresAt?: unknown; selectedChoiceId?: unknown }>([
      ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { expiresAt: hoursAgo(2), selectedChoiceId: null }],
      ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', { expiresAt: hoursAgo(2), selectedChoiceId: 'done' }],
    ]);

    const visible = filterExpiredUnansweredConsultNotifications(
      [consultExpired, consultAnswered, consultMissingPayload, conversation],
      payloadByEventId,
      NOW_MS,
    );

    expect(visible.map((item) => item.id)).toEqual(['c2', 'c3', 'n1']);
  });
});
