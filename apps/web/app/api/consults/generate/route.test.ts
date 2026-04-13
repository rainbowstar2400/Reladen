import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const recentChain = {
    eq: vi.fn(),
    contains: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  recentChain.eq.mockReturnValue(recentChain);
  recentChain.contains.mockReturnValue(recentChain);
  recentChain.order.mockReturnValue(recentChain);

  return {
    getKV: vi.fn(),
    getRawKV: vi.fn(),
    listActiveKV: vi.fn(),
    putKV: vi.fn(),
    generateConsultTheme: vi.fn(),
    MockKvUnauthenticatedError: class MockKvUnauthenticatedError extends Error {},
    sbFrom: vi.fn(),
    recentSelect: vi.fn(),
    recentChain,
  };
});

vi.mock("@/lib/db/kv-server", () => ({
  getKV: mocks.getKV,
  getRawKV: mocks.getRawKV,
  listActiveKV: mocks.listActiveKV,
  putKV: mocks.putKV,
  KvUnauthenticatedError: mocks.MockKvUnauthenticatedError,
}));

vi.mock("@/lib/supabase/server", () => ({
  sbServer: () => ({
    from: mocks.sbFrom,
  }),
}));

vi.mock("@/lib/gpt/call-gpt-for-consult", () => ({
  generateConsultTheme: mocks.generateConsultTheme,
}));

import { POST } from "@/app/api/consults/generate/route";

const RESIDENT_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-8222-222222222222";
const TRIGGER_ID = "33333333-3333-4333-8333-333333333333";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/consults/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/consults/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.putKV.mockResolvedValue(undefined);
    mocks.generateConsultTheme.mockResolvedValue({
      title: "告白について相談したい",
      content: "好きな人に伝えるべきか迷っている。",
      choices: [
        { id: "a", label: "背中を押す", favorability: "positive" },
        { id: "b", label: "様子を見る", favorability: "neutral" },
        { id: "c", label: "止める", favorability: "negative" },
      ],
    });
    mocks.listActiveKV.mockResolvedValue([]);
    mocks.getRawKV.mockResolvedValue(null);
    mocks.getKV.mockImplementation(async (table: string) => {
      if (table === "residents") {
        return { id: RESIDENT_ID, name: "住人A", deleted: false, traits: {}, trustToPlayer: 50 };
      }
      if (table === "presets") {
        return null;
      }
      return null;
    });

    mocks.recentChain.eq.mockReturnValue(mocks.recentChain);
    mocks.recentChain.contains.mockReturnValue(mocks.recentChain);
    mocks.recentChain.order.mockReturnValue(mocks.recentChain);
    mocks.recentChain.limit.mockResolvedValue({ data: [], error: null });
    mocks.recentSelect.mockReturnValue(mocks.recentChain);
    mocks.sbFrom.mockImplementation((table: string) => {
      if (table === "events") {
        return { select: mocks.recentSelect };
      }
      throw new Error(`unexpected table: ${table}`);
    });
  });

  it("relation_trigger 経由の生成成功時に handled=true を反映する", async () => {
    const triggerEvent = {
      id: TRIGGER_ID,
      kind: "relation_trigger",
      deleted: false,
      updated_at: "2026-03-20T00:00:00.000Z",
      payload: {
        trigger: "confession",
        residentId: RESIDENT_ID,
        targetId: TARGET_ID,
        participants: [RESIDENT_ID, TARGET_ID],
        currentRelation: "friend",
        handled: false,
      },
    };
    mocks.getRawKV.mockResolvedValue(triggerEvent);

    const res = await POST(makeRequest({ residentId: RESIDENT_ID, triggerId: TRIGGER_ID }));
    expect(res.status).toBe(200);

    const handledWrite = mocks.putKV.mock.calls.find(
      ([table, value]) => table === "events" && value?.id === TRIGGER_ID,
    );
    expect(handledWrite).toBeTruthy();
    expect(handledWrite?.[1]?.payload).toMatchObject({
      trigger: "confession",
      residentId: RESIDENT_ID,
      targetId: TARGET_ID,
      participants: [RESIDENT_ID, TARGET_ID],
      handled: true,
    });
  });

  it("handled 済み trigger は 409 を返して重複生成しない", async () => {
    mocks.getRawKV.mockResolvedValue({
      id: TRIGGER_ID,
      kind: "relation_trigger",
      deleted: false,
      payload: {
        trigger: "breakup",
        residentId: RESIDENT_ID,
        targetId: TARGET_ID,
        participants: [RESIDENT_ID, TARGET_ID],
        handled: true,
      },
    });

    const res = await POST(makeRequest({ residentId: RESIDENT_ID, triggerId: TRIGGER_ID }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("trigger_already_handled");
    expect(mocks.putKV).not.toHaveBeenCalled();
  });

  it("削除済み住人IDでは resident_not_found を返す", async () => {
    mocks.getKV.mockImplementation(async (table: string) => {
      if (table === "residents") return null;
      return null;
    });

    const res = await POST(makeRequest({ residentId: RESIDENT_ID }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("resident_not_found");
  });

  it("削除済みトリガーは無視して通常相談として生成する", async () => {
    mocks.getRawKV.mockResolvedValue({
      id: TRIGGER_ID,
      kind: "relation_trigger",
      deleted: true,
      payload: {
        trigger: "confession",
        residentId: RESIDENT_ID,
        targetId: TARGET_ID,
        participants: [RESIDENT_ID, TARGET_ID],
        handled: false,
      },
    });

    const res = await POST(makeRequest({ residentId: RESIDENT_ID, triggerId: TRIGGER_ID }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.consultPayload.triggerEventId).toBe(TRIGGER_ID);
    const handledWrite = mocks.putKV.mock.calls.find(
      ([table, value]) => table === "events" && value?.id === TRIGGER_ID && value?.payload?.handled === true,
    );
    expect(handledWrite).toBeFalsy();
    expect(mocks.sbFrom).toHaveBeenCalledWith("events");
  });

  it("通常相談の通知 snippet は 30文字以下なら省略記号を付けない", async () => {
    mocks.generateConsultTheme.mockResolvedValue({
      title: "相談タイトル",
      content: "123456789012345678901234567890",
      choices: [
        { id: "a", label: "A", favorability: "positive" },
        { id: "b", label: "B", favorability: "neutral" },
        { id: "c", label: "C", favorability: "negative" },
      ],
    });

    const res = await POST(makeRequest({ residentId: RESIDENT_ID }));
    expect(res.status).toBe(200);

    const notificationWrite = mocks.putKV.mock.calls.find(([table]) => table === "notifications");
    expect(notificationWrite?.[1]?.snippet).toBe("123456789012345678901234567890");
  });

  it("通常相談の通知 snippet は 30文字超過時のみ省略記号を付ける", async () => {
    mocks.generateConsultTheme.mockResolvedValue({
      title: "相談タイトル",
      content: "1234567890123456789012345678901",
      choices: [
        { id: "a", label: "A", favorability: "positive" },
        { id: "b", label: "B", favorability: "neutral" },
        { id: "c", label: "C", favorability: "negative" },
      ],
    });

    const res = await POST(makeRequest({ residentId: RESIDENT_ID }));
    expect(res.status).toBe(200);

    const notificationWrite = mocks.putKV.mock.calls.find(([table]) => table === "notifications");
    expect(notificationWrite?.[1]?.snippet).toBe("123456789012345678901234567890…");
  });
});
