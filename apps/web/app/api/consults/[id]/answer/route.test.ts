import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listKV: vi.fn(),
  putKV: vi.fn(),
  generateConsultReply: vi.fn(),
  MockKvUnauthenticatedError: class MockKvUnauthenticatedError extends Error {},
}));

vi.mock("@/lib/db/kv-server", () => ({
  listKV: mocks.listKV,
  putKV: mocks.putKV,
  KvUnauthenticatedError: mocks.MockKvUnauthenticatedError,
}));

vi.mock("@/lib/gpt/call-gpt-for-consult", () => ({
  generateConsultReply: mocks.generateConsultReply,
}));

import { POST } from "@/app/api/consults/[id]/answer/route";

const CONSULT_ID = "11111111-1111-4111-8111-111111111111";
const TRIGGER_ID = "22222222-2222-4222-8222-222222222222";
const RESIDENT_ID = "33333333-3333-4333-8333-333333333333";
const TARGET_ID = "44444444-4444-4444-8444-444444444444";

type InMemoryDb = Record<string, any[]>;

function makeRequest(selectedChoiceId: string) {
  return new Request(`http://localhost/api/consults/${CONSULT_ID}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selectedChoiceId }),
  });
}

function configureDb(db: InMemoryDb) {
  mocks.listKV.mockImplementation(async (table: string) => db[table] ?? []);
  mocks.putKV.mockImplementation(async (table: string, value: any) => {
    if (!db[table]) db[table] = [];
    const idx = db[table].findIndex((row) => row?.id === value?.id);
    if (idx >= 0) db[table][idx] = value;
    else db[table].push(value);
    return value;
  });
}

function buildDb(params: {
  trigger: "confession" | "breakup";
  relationType: string;
  residentFeelingLabel: string;
  residentFeelingScore: number;
  targetFeelingLabel: string;
  targetFeelingScore: number;
}): InMemoryDb {
  return {
    residents: [
      { id: RESIDENT_ID, name: "住人A", deleted: false, trustToPlayer: 50, traits: { empathy: 3 } },
      { id: TARGET_ID, name: "住人B", deleted: false, trustToPlayer: 50, traits: { empathy: 3 } },
    ],
    presets: [],
    relations: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        a_id: RESIDENT_ID,
        b_id: TARGET_ID,
        type: params.relationType,
        deleted: false,
      },
    ],
    feelings: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        from_id: RESIDENT_ID,
        to_id: TARGET_ID,
        label: params.residentFeelingLabel,
        score: params.residentFeelingScore,
        deleted: false,
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        from_id: TARGET_ID,
        to_id: RESIDENT_ID,
        label: params.targetFeelingLabel,
        score: params.targetFeelingScore,
        deleted: false,
      },
    ],
    events: [
      {
        id: CONSULT_ID,
        kind: "consult",
        updated_at: "2026-03-20T00:00:00.000Z",
        deleted: false,
        payload: {
          residentId: RESIDENT_ID,
          content: "相談内容",
          participants: [RESIDENT_ID, TARGET_ID],
          triggerEventId: TRIGGER_ID,
          choices: [
            { id: "positive", label: "背中を押す", favorability: "positive" },
            { id: "neutral", label: "様子を見る", favorability: "neutral" },
            { id: "negative", label: "止める", favorability: "negative" },
          ],
        },
      },
      {
        id: TRIGGER_ID,
        kind: "relation_trigger",
        updated_at: "2026-03-20T00:00:00.000Z",
        deleted: false,
        payload: {
          trigger: params.trigger,
          residentId: RESIDENT_ID,
          targetId: TARGET_ID,
          participants: [RESIDENT_ID, TARGET_ID],
          currentRelation: params.relationType,
          handled: true,
        },
      },
    ],
  };
}

describe("POST /api/consults/[id]/answer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateConsultReply.mockResolvedValue({
      reply: "ありがとう。少し落ち着いた。",
      favorability: "negative",
    });
  });

  it("confession: positive は成功時に lover + 双方 like へ遷移する", async () => {
    const db = buildDb({
      trigger: "confession",
      relationType: "friend",
      residentFeelingLabel: "maybe_like",
      residentFeelingScore: 60,
      targetFeelingLabel: "maybe_like",
      targetFeelingScore: 85,
    });
    configureDb(db);
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    const res = await POST(makeRequest("positive"), { params: { id: CONSULT_ID } } as any);
    randomSpy.mockRestore();
    expect(res.status).toBe(200);

    const relation = db.relations.find((row) => row.id === "55555555-5555-4555-8555-555555555555");
    expect(relation?.type).toBe("lover");
    expect(db.feelings.find((f) => f.from_id === RESIDENT_ID && f.to_id === TARGET_ID)?.label).toBe("like");
    expect(db.feelings.find((f) => f.from_id === TARGET_ID && f.to_id === RESIDENT_ID)?.label).toBe("like");
    expect(db.events.some((e) => e.kind === "system" && e.payload?.subType === "confession_success")).toBe(true);
  });

  it("confession: neutral は失敗時に関係据え置き + 双方 awkward", async () => {
    const db = buildDb({
      trigger: "confession",
      relationType: "friend",
      residentFeelingLabel: "maybe_like",
      residentFeelingScore: 60,
      targetFeelingLabel: "none",
      targetFeelingScore: 0,
    });
    configureDb(db);
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.99);

    const res = await POST(makeRequest("neutral"), { params: { id: CONSULT_ID } } as any);
    randomSpy.mockRestore();
    expect(res.status).toBe(200);

    const relation = db.relations.find((row) => row.id === "55555555-5555-4555-8555-555555555555");
    expect(relation?.type).toBe("friend");
    expect(db.feelings.find((f) => f.from_id === RESIDENT_ID && f.to_id === TARGET_ID)?.label).toBe("awkward");
    expect(db.feelings.find((f) => f.from_id === TARGET_ID && f.to_id === RESIDENT_ID)?.label).toBe("awkward");
    expect(db.events.some((e) => e.kind === "system" && e.payload?.subType === "confession_success")).toBe(false);
  });

  it("confession: negative は現行維持（印象リセット + クールダウン）", async () => {
    const db = buildDb({
      trigger: "confession",
      relationType: "friend",
      residentFeelingLabel: "maybe_like",
      residentFeelingScore: 60,
      targetFeelingLabel: "none",
      targetFeelingScore: 10,
    });
    configureDb(db);

    const res = await POST(makeRequest("negative"), { params: { id: CONSULT_ID } } as any);
    expect(res.status).toBe(200);

    const relation = db.relations.find((row) => row.id === "55555555-5555-4555-8555-555555555555");
    const feeling = db.feelings.find((f) => f.from_id === RESIDENT_ID && f.to_id === TARGET_ID);
    expect(relation?.type).toBe("friend");
    expect(feeling?.label).toBe("curious");
    expect(feeling?.base_label).toBe("curious");
    expect(feeling?.special_label).toBe(null);
    expect(feeling?.base_before_special).toBe(null);
    expect(db.events.some((e) => e.kind === "consult_cooldown" && e.payload?.trigger === "confession")).toBe(true);
  });

  it("breakup: positive は friend へ降格し降格印象ロジックを適用する", async () => {
    const db = buildDb({
      trigger: "breakup",
      relationType: "lover",
      residentFeelingLabel: "love",
      residentFeelingScore: 60,
      targetFeelingLabel: "like",
      targetFeelingScore: 20,
    });
    configureDb(db);

    const res = await POST(makeRequest("positive"), { params: { id: CONSULT_ID } } as any);
    expect(res.status).toBe(200);

    const relation = db.relations.find((row) => row.id === "55555555-5555-4555-8555-555555555555");
    expect(relation?.type).toBe("friend");
    expect(db.feelings.find((f) => f.from_id === RESIDENT_ID && f.to_id === TARGET_ID)?.label).toBe("maybe_like");
    expect(db.feelings.find((f) => f.from_id === TARGET_ID && f.to_id === RESIDENT_ID)?.label).toBe("maybe_dislike");
    expect(db.events.some((e) => e.kind === "system" && e.payload?.subType === "breakup_success")).toBe(true);
  });

  it("breakup: neutral も friend へ降格する", async () => {
    const db = buildDb({
      trigger: "breakup",
      relationType: "lover",
      residentFeelingLabel: "love",
      residentFeelingScore: 58,
      targetFeelingLabel: "like",
      targetFeelingScore: 42,
    });
    configureDb(db);

    const res = await POST(makeRequest("neutral"), { params: { id: CONSULT_ID } } as any);
    expect(res.status).toBe(200);

    const relation = db.relations.find((row) => row.id === "55555555-5555-4555-8555-555555555555");
    expect(relation?.type).toBe("friend");
    expect(db.events.some((e) => e.kind === "system" && e.payload?.subType === "breakup_success")).toBe(true);
  });

  it("breakup: negative は現行維持（印象リセット + クールダウン）", async () => {
    const db = buildDb({
      trigger: "breakup",
      relationType: "lover",
      residentFeelingLabel: "dislike",
      residentFeelingScore: 10,
      targetFeelingLabel: "maybe_like",
      targetFeelingScore: 40,
    });
    configureDb(db);

    const res = await POST(makeRequest("negative"), { params: { id: CONSULT_ID } } as any);
    expect(res.status).toBe(200);

    const relation = db.relations.find((row) => row.id === "55555555-5555-4555-8555-555555555555");
    const feeling = db.feelings.find((f) => f.from_id === RESIDENT_ID && f.to_id === TARGET_ID);
    expect(relation?.type).toBe("lover");
    expect(feeling?.label).toBe("none");
    expect(feeling?.base_label).toBe("none");
    expect(feeling?.special_label).toBe(null);
    expect(feeling?.base_before_special).toBe(null);
    expect(db.events.some((e) => e.kind === "consult_cooldown" && e.payload?.trigger === "breakup")).toBe(true);
  });
});
