import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventLogStrict, NotificationRecord } from '@repo/shared/types/conversation';

const mocks = vi.hoisted(() => ({
  listLocal: vi.fn(),
  putLocal: vi.fn(),
  getLocal: vi.fn(),
  bulkUpsert: vi.fn(),
  remoteFetchEventById: vi.fn(),
  remoteFetchRecentNotifications: vi.fn(),
  remoteUpsertNotification: vi.fn(),
}));

vi.mock('@/lib/db-local', () => ({
  listLocal: mocks.listLocal,
  putLocal: mocks.putLocal,
  getLocal: mocks.getLocal,
  bulkUpsert: mocks.bulkUpsert,
}));

vi.mock('@/lib/sync/remote-events', () => ({
  remoteFetchEventById: mocks.remoteFetchEventById,
}));

vi.mock('@/lib/sync/remote-notifications', () => ({
  remoteFetchRecentNotifications: mocks.remoteFetchRecentNotifications,
  remoteUpsertNotification: mocks.remoteUpsertNotification,
}));

import { listNotifications, resolveVisibleNotifications } from '@/lib/data/notifications';

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

describe('notifications visibility pipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_ISO));
    vi.clearAllMocks();
    mocks.remoteFetchRecentNotifications.mockResolvedValue([]);
    mocks.remoteFetchEventById.mockResolvedValue(null);
    mocks.listLocal.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('オフラインでも鮮度と期限切れ相談のフィルタを適用する', async () => {
    const notifications: NotificationRecord[] = [
      makeNotification({ id: 'n_recent', type: 'conversation', status: 'unread', occurredAt: hoursAgo(2) }),
      makeNotification({ id: 'n_old_read', type: 'conversation', status: 'read', occurredAt: hoursAgo(6) }),
      makeNotification({
        id: 'c_expired',
        type: 'consult',
        linkedEventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        status: 'unread',
        occurredAt: hoursAgo(1),
      }),
      makeNotification({
        id: 'c_answered',
        type: 'consult',
        linkedEventId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        status: 'unread',
        occurredAt: hoursAgo(1),
      }),
    ];

    const localEvents: EventLogStrict[] = [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        kind: 'consult',
        payload: { expiresAt: hoursAgo(2), selectedChoiceId: null },
        updated_at: NOW_ISO,
        deleted: false,
      } as EventLogStrict,
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        kind: 'consult',
        payload: { expiresAt: hoursAgo(2), selectedChoiceId: 'choice_1' },
        updated_at: NOW_ISO,
        deleted: false,
      } as EventLogStrict,
    ];

    mocks.listLocal.mockImplementation(async (table: string) => {
      if (table === 'events') return localEvents;
      return [];
    });

    const visible = await resolveVisibleNotifications(notifications, {
      nowMs: NOW_MS,
      isOnline: false,
    });

    expect(visible.map((item) => item.id)).toEqual(['n_recent', 'c_answered']);
    expect(mocks.remoteFetchEventById).not.toHaveBeenCalled();
  });

  it('同一ローカルデータならオンライン/オフラインで可視結果が一致する', async () => {
    const notifications: NotificationRecord[] = [
      makeNotification({
        id: 'c_local',
        type: 'consult',
        linkedEventId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        status: 'unread',
        occurredAt: hoursAgo(2),
      }),
      makeNotification({ id: 'n_recent', type: 'conversation', status: 'unread', occurredAt: hoursAgo(1) }),
    ];

    const localEvents: EventLogStrict[] = [
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        kind: 'consult',
        payload: { expiresAt: hoursAgo(1), selectedChoiceId: 'choice_9' },
        updated_at: NOW_ISO,
        deleted: false,
      } as EventLogStrict,
    ];

    mocks.listLocal.mockImplementation(async (table: string) => {
      if (table === 'events') return localEvents;
      return [];
    });

    const offline = await resolveVisibleNotifications(notifications, {
      nowMs: NOW_MS,
      isOnline: false,
    });
    const online = await resolveVisibleNotifications(notifications, {
      nowMs: NOW_MS,
      isOnline: true,
    });

    expect(online.map((item) => item.id)).toEqual(offline.map((item) => item.id));
    expect(mocks.remoteFetchEventById).not.toHaveBeenCalled();
  });

  it('listNotifications も共通の可視性パイプラインを通る', async () => {
    const notifications: NotificationRecord[] = [
      makeNotification({ id: 'n_recent', type: 'conversation', status: 'unread', occurredAt: hoursAgo(1) }),
      makeNotification({ id: 'n_archived', type: 'conversation', status: 'archived', occurredAt: hoursAgo(1) }),
      makeNotification({
        id: 'c_expired',
        type: 'consult',
        linkedEventId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        status: 'unread',
        occurredAt: hoursAgo(1),
      }),
    ];
    const localEvents: EventLogStrict[] = [
      {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        kind: 'consult',
        payload: { expiresAt: hoursAgo(2), selectedChoiceId: null },
        updated_at: NOW_ISO,
        deleted: false,
      } as EventLogStrict,
    ];

    mocks.listLocal.mockImplementation(async (table: string) => {
      if (table === 'notifications') return notifications;
      if (table === 'events') return localEvents;
      return [];
    });

    const visible = await listNotifications();

    expect(visible.map((item) => item.id)).toEqual(['n_recent']);
  });
});
