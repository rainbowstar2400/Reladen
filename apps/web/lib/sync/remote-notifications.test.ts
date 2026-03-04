import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationRecord } from "@repo/shared/types/conversation";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db-cloud/supabase", () => ({
  supabaseClient: {
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  },
}));

import {
  remoteFetchRecentNotifications,
  remoteUpsertNotification,
} from "@/lib/sync/remote-notifications";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "22222222-2222-4222-8222-222222222222";
const PARTICIPANT_A = "33333333-3333-4333-8333-333333333333";
const PARTICIPANT_B = "44444444-4444-4444-8444-444444444444";
const NOTIFICATION_ID = "55555555-5555-4555-8555-555555555555";
const NOW = "2026-01-01T00:00:00.000Z";

function makeNotificationRow(participants: unknown, id = NOTIFICATION_ID) {
  return {
    id,
    type: "conversation",
    linked_event_id: EVENT_ID,
    thread_id: null,
    participants,
    snippet: null,
    occurred_at: NOW,
    status: "unread",
    priority: 0,
    updated_at: NOW,
    owner_id: OWNER_ID,
  };
}

function makeRecord(): NotificationRecord {
  return {
    id: NOTIFICATION_ID,
    type: "conversation",
    linkedEventId: EVENT_ID,
    occurredAt: NOW,
    status: "unread",
    priority: 0,
    updated_at: NOW,
  };
}

describe("remote-notifications participants validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.from.mockReturnValue({
      select: mocks.select,
      upsert: mocks.upsert,
    });
    mocks.select.mockReturnValue({
      order: mocks.order,
    });
    mocks.order.mockReturnValue({
      limit: mocks.limit,
    });
    mocks.limit.mockResolvedValue({
      data: [],
      error: null,
    });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.getUser.mockResolvedValue({
      data: { user: { id: OWNER_ID } },
      error: null,
    });
  });

  it("participants=null を undefined に変換する", async () => {
    mocks.limit.mockResolvedValue({
      data: [makeNotificationRow(null)],
      error: null,
    });

    const result = await remoteFetchRecentNotifications(1);
    expect(result).toHaveLength(1);
    expect(result[0]?.participants).toBeUndefined();
  });

  it("participants=[string, string] を tuple として扱う", async () => {
    const tuple: [string, string] = [PARTICIPANT_A, PARTICIPANT_B];
    mocks.limit.mockResolvedValue({
      data: [makeNotificationRow(tuple)],
      error: null,
    });

    const result = await remoteFetchRecentNotifications(1);
    expect(result).toHaveLength(1);
    expect(result[0]?.participants).toEqual(tuple);
  });

  it("participants=string の場合はエラーを投げる", async () => {
    mocks.limit.mockResolvedValue({
      data: [makeNotificationRow("abc")],
      error: null,
    });

    await expect(remoteFetchRecentNotifications(1)).rejects.toThrow(
      `Invalid participants for notification ${NOTIFICATION_ID}`,
    );
    await expect(remoteFetchRecentNotifications(1)).rejects.toThrow("received string:");
  });

  it("participants の要素数が2でない場合はエラーを投げる", async () => {
    mocks.limit.mockResolvedValue({
      data: [makeNotificationRow([PARTICIPANT_A])],
      error: null,
    });

    await expect(remoteFetchRecentNotifications(1)).rejects.toThrow(
      `Invalid participants for notification ${NOTIFICATION_ID}`,
    );
    await expect(remoteFetchRecentNotifications(1)).rejects.toThrow("array(length=1)");
  });

  it("participants に文字列以外が含まれる場合はエラーを投げる", async () => {
    mocks.limit.mockResolvedValue({
      data: [makeNotificationRow([PARTICIPANT_A, 1])],
      error: null,
    });

    await expect(remoteFetchRecentNotifications(1)).rejects.toThrow(
      `Invalid participants for notification ${NOTIFICATION_ID}`,
    );
  });

  it("remoteFetchRecentNotifications は不正行を含むと reject する", async () => {
    const invalidId = "66666666-6666-4666-8666-666666666666";
    mocks.limit.mockResolvedValue({
      data: [
        makeNotificationRow([PARTICIPANT_A, PARTICIPANT_B]),
        makeNotificationRow(42, invalidId),
      ],
      error: null,
    });

    await expect(remoteFetchRecentNotifications(2)).rejects.toThrow(
      `Invalid participants for notification ${invalidId}`,
    );
  });

  it("upsert 時も participants が不正ならエラーを投げる", async () => {
    const invalid = { ...makeRecord(), participants: "abc" } as unknown as NotificationRecord;

    await expect(remoteUpsertNotification(invalid)).rejects.toThrow(
      `Invalid participants for notification ${NOTIFICATION_ID}`,
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
