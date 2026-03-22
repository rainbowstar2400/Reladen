import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listLocal: vi.fn(),
  putLocal: vi.fn(),
}));

vi.mock("@/lib/db-local", () => ({
  listLocal: mocks.listLocal,
  putLocal: mocks.putLocal,
}));

import { fetchResidentChangeEvents, fetchResidentRelatedEvents } from "@/lib/data/events";

const RESIDENT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

function eventId(seq: number): string {
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

function makeEvent(params: {
  seq: number;
  related: boolean;
  updatedAt: string;
}) {
  return {
    id: eventId(params.seq),
    kind: "system",
    updated_at: params.updatedAt,
    deleted: false,
    payload: {
      participants: params.related ? [RESIDENT_ID, OTHER_ID] : [OTHER_ID, OTHER_ID],
      marker: `event-${params.seq}`,
    },
  };
}

function makeChangeEvent(params: {
  seq: number;
  related: boolean;
  kind: "conversation" | "system" | "consult";
  updatedAt: string;
  includeChangeMarker: boolean;
}) {
  const participants = params.related ? [RESIDENT_ID, OTHER_ID] : [OTHER_ID, OTHER_ID];

  if (params.kind === "conversation") {
    return {
      id: eventId(params.seq),
      kind: "conversation",
      updated_at: params.updatedAt,
      deleted: false,
      payload: {
        participants,
        systemLine: params.includeChangeMarker ? "SYSTEM: テスト変化" : "",
      },
    };
  }

  if (params.kind === "system") {
    return {
      id: eventId(params.seq),
      kind: "system",
      updated_at: params.updatedAt,
      deleted: false,
      payload: {
        participants,
        type: params.includeChangeMarker ? "relation_transition" : "other_system",
      },
    };
  }

  return {
    id: eventId(params.seq),
    kind: "consult",
    updated_at: params.updatedAt,
    deleted: false,
    payload: {
      participants,
      residentId: params.related ? RESIDENT_ID : OTHER_ID,
      trustDelta: params.includeChangeMarker ? 1 : null,
      answeredAt: params.includeChangeMarker ? params.updatedAt : null,
    },
  };
}

describe("fetchResidentRelatedEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("無関係イベントが多くても住人関連の最新15件を返す", async () => {
    const items = [
      ...Array.from({ length: 5 }).map((_, idx) =>
        makeEvent({
          seq: idx + 1,
          related: false,
          updatedAt: `2026-03-20T10:0${idx}:00.000Z`,
        })),
      ...Array.from({ length: 20 }).map((_, idx) =>
        makeEvent({
          seq: idx + 101,
          related: true,
          updatedAt: `2026-03-20T09:${String(59 - idx).padStart(2, "0")}:00.000Z`,
        })),
    ];
    mocks.listLocal.mockResolvedValueOnce(items);

    const result = await fetchResidentRelatedEvents(RESIDENT_ID);

    expect(result).toHaveLength(15);
    expect(result.every((e) => (e as any).payload?.participants?.includes(RESIDENT_ID))).toBe(true);
    expect(result[0]?.id).toBe(eventId(101));
    expect(result[14]?.id).toBe(eventId(115));
  });

  it("関連イベント件数の境界（14/15/16）で上限15件を守る", async () => {
    for (const count of [14, 15, 16]) {
      const items = Array.from({ length: count }).map((_, idx) =>
        makeEvent({
          seq: 200 + idx,
          related: true,
          updatedAt: `2026-03-20T08:${String(59 - idx).padStart(2, "0")}:00.000Z`,
        }),
      );
      mocks.listLocal.mockResolvedValueOnce(items);

      const result = await fetchResidentRelatedEvents(RESIDENT_ID);
      const expected = count >= 15 ? 15 : count;
      expect(result).toHaveLength(expected);
    }
  });
});

describe("fetchResidentChangeEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("表示対象抽出後に limit を適用し、取りこぼしを防ぐ", async () => {
    const newestNonTarget = Array.from({ length: 20 }).map((_, idx) =>
      makeChangeEvent({
        seq: 300 + idx,
        related: true,
        kind: "system",
        updatedAt: `2026-03-21T10:${String(59 - idx).padStart(2, "0")}:00.000Z`,
        includeChangeMarker: false,
      }),
    );
    const olderTarget = Array.from({ length: 20 }).map((_, idx) =>
      makeChangeEvent({
        seq: 500 + idx,
        related: true,
        kind: "conversation",
        updatedAt: `2026-03-21T09:${String(59 - idx).padStart(2, "0")}:00.000Z`,
        includeChangeMarker: true,
      }),
    );
    mocks.listLocal.mockResolvedValueOnce([...newestNonTarget, ...olderTarget]);

    const result = await fetchResidentChangeEvents(RESIDENT_ID, 15);

    expect(result).toHaveLength(15);
    expect(result.every((event) => event.kind === "conversation")).toBe(true);
    expect(result[0]?.id).toBe(eventId(500));
    expect(result[14]?.id).toBe(eventId(514));
  });

  it("conversation/system/consult の表示対象のみを返す", async () => {
    const items = [
      makeChangeEvent({
        seq: 601,
        related: true,
        kind: "conversation",
        updatedAt: "2026-03-21T08:03:00.000Z",
        includeChangeMarker: true,
      }),
      makeChangeEvent({
        seq: 602,
        related: true,
        kind: "system",
        updatedAt: "2026-03-21T08:02:00.000Z",
        includeChangeMarker: true,
      }),
      makeChangeEvent({
        seq: 603,
        related: true,
        kind: "consult",
        updatedAt: "2026-03-21T08:01:00.000Z",
        includeChangeMarker: true,
      }),
      makeChangeEvent({
        seq: 604,
        related: true,
        kind: "consult",
        updatedAt: "2026-03-21T08:00:00.000Z",
        includeChangeMarker: false,
      }),
      makeChangeEvent({
        seq: 605,
        related: false,
        kind: "conversation",
        updatedAt: "2026-03-21T07:59:00.000Z",
        includeChangeMarker: true,
      }),
    ];
    mocks.listLocal.mockResolvedValueOnce(items);

    const result = await fetchResidentChangeEvents(RESIDENT_ID, 15);

    expect(result.map((event) => event.id)).toEqual([eventId(601), eventId(602), eventId(603)]);
  });
});

