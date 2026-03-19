import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listKV: vi.fn(),
  putKV: vi.fn(),
  generateConsultTheme: vi.fn(),
  MockKvUnauthenticatedError: class MockKvUnauthenticatedError extends Error {},
}));

vi.mock("@/lib/db/kv-server", () => ({
  listKV: mocks.listKV,
  putKV: mocks.putKV,
  KvUnauthenticatedError: mocks.MockKvUnauthenticatedError,
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
    mocks.listKV.mockImplementation(async (table: string) => {
      if (table === "events") return [triggerEvent];
      if (table === "residents") {
        return [{ id: RESIDENT_ID, name: "住人A", deleted: false, traits: {}, trustToPlayer: 50 }];
      }
      if (table === "presets") return [];
      return [];
    });

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
    mocks.listKV.mockImplementation(async (table: string) => {
      if (table === "events") {
        return [{
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
        }];
      }
      return [];
    });

    const res = await POST(makeRequest({ residentId: RESIDENT_ID, triggerId: TRIGGER_ID }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("trigger_already_handled");
    expect(mocks.putKV).not.toHaveBeenCalled();
  });
});

