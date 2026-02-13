import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listKV: vi.fn(),
  putKV: vi.fn(),
  newId: vi.fn(),
}));

vi.mock("@/lib/db/kv-server", () => ({
  listKV: mocks.listKV,
  putKV: mocks.putKV,
}));

vi.mock("@/lib/newId", () => ({
  newId: mocks.newId,
}));

import {
  buildExperienceCandidates,
  generateAndPersistExperienceForParticipants,
  validateExperienceCandidate,
} from "@/lib/conversation/experience-generator";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";
const C_ID = "33333333-3333-4333-8333-333333333333";

function setupBaseListKv(overrides: Partial<Record<string, unknown[]>> = {}) {
  const tableMap: Record<string, unknown[]> = {
    residents: [
      { id: A_ID, name: "遥", occupation: "part_time", deleted: false },
      { id: B_ID, name: "湊", deleted: false },
      { id: C_ID, name: "凪", deleted: false },
    ],
    relations: [
      { a_id: A_ID, b_id: B_ID, type: "friend", updated_at: "2026-02-14T10:00:00.000Z", deleted: false },
      { a_id: A_ID, b_id: C_ID, type: "friend", updated_at: "2026-02-14T10:00:00.000Z", deleted: false },
    ],
    feelings: [
      { from_id: A_ID, to_id: B_ID, score: 70, updated_at: "2026-02-14T10:00:00.000Z", deleted: false },
      { from_id: B_ID, to_id: A_ID, score: 68, updated_at: "2026-02-14T10:00:00.000Z", deleted: false },
    ],
    world_states: [
      {
        id: "world",
        weather_current: { kind: "rain" },
        updated_at: "2026-02-14T10:00:00.000Z",
        deleted: false,
      },
    ],
    experience_events: [],
    resident_experiences: [],
    ...overrides,
  };

  mocks.listKV.mockImplementation(async (table: string) => {
    return tableMap[table] ?? [];
  });
}

describe("experience-generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_EXPERIENCE_RUMOR = "on";
    process.env.NEXT_PUBLIC_EXPERIENCE_VARIATION = "normal";

    let seq = 0;
    mocks.newId.mockImplementation(() => {
      seq += 1;
      return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
    });
    mocks.putKV.mockResolvedValue(undefined);
  });

  it("候補採用時に experience_events / resident_experiences を保存する", async () => {
    setupBaseListKv();

    const result = await generateAndPersistExperienceForParticipants({
      participants: [A_ID, B_ID],
      nowIso: "2026-02-14T12:00:00.000Z",
    });

    expect(result.created).toBe(true);
    expect(mocks.putKV.mock.calls.some((call) => call[0] === "experience_events")).toBe(true);
    const residentWrites = mocks.putKV.mock.calls.filter((call) => call[0] === "resident_experiences");
    expect(residentWrites.length).toBeGreaterThanOrEqual(2);
  });

  it("同一署名のクールダウン中は同じ署名を再採用しない", async () => {
    const signature = buildExperienceCandidates({
      participants: [A_ID, B_ID],
      residents: [
        { id: A_ID, name: "遥", occupation: "part_time", deleted: false },
        { id: B_ID, name: "湊", deleted: false },
      ],
      relations: [
        { a_id: A_ID, b_id: B_ID, type: "friend", updated_at: "2026-02-14T10:00:00.000Z", deleted: false },
      ],
      feelings: [
        { from_id: A_ID, to_id: B_ID, score: 70, updated_at: "2026-02-14T10:00:00.000Z", deleted: false },
        { from_id: B_ID, to_id: A_ID, score: 68, updated_at: "2026-02-14T10:00:00.000Z", deleted: false },
      ],
      weatherKind: "rain",
      nowIso: "2026-02-14T12:00:00.000Z",
    })[0]?.signature;
    expect(signature).toBeTruthy();

    setupBaseListKv({
      experience_events: [
        {
          id: "old-exp",
          source_type: "lifestyle",
          signature,
          fact_detail: { pairKey: `${A_ID}:${B_ID}` },
          occurred_at: "2026-02-14T09:30:00.000Z",
          deleted: false,
        },
      ],
    });

    const result = await generateAndPersistExperienceForParticipants({
      participants: [A_ID, B_ID],
      nowIso: "2026-02-14T12:00:00.000Z",
    });

    expect(result.created).toBe(true);
    const eventWrite = mocks.putKV.mock.calls.find((call) => call[0] === "experience_events");
    expect(eventWrite).toBeTruthy();
    expect((eventWrite?.[1] as { signature?: string })?.signature).not.toBe(signature);
  });

  it("heard は direct より confidence が低い", async () => {
    setupBaseListKv();

    const result = await generateAndPersistExperienceForParticipants({
      participants: [A_ID, B_ID],
      nowIso: "2026-02-14T12:00:00.000Z",
    });
    expect(result.created).toBe(true);

    const writes = mocks.putKV.mock.calls
      .filter((call) => call[0] === "resident_experiences")
      .map((call) => call[1] as { awareness: string; confidence: number; resident_id: string });

    const direct = writes.find((row) => row.awareness === "direct");
    const heard = writes.find((row) => row.awareness === "heard" && row.resident_id === C_ID);
    expect(direct).toBeTruthy();
    expect(heard).toBeTruthy();
    expect((heard as any).confidence).toBeLessThan((direct as any).confidence);
  });

  it("appraisal が空の候補は validate で棄却される", () => {
    const candidate = buildExperienceCandidates({
      participants: [A_ID, B_ID],
      residents: [
        { id: A_ID, name: "遥", deleted: false },
        { id: B_ID, name: "湊", deleted: false },
      ],
      relations: [],
      feelings: [],
      weatherKind: "sunny",
      nowIso: "2026-02-14T12:00:00.000Z",
    })[0];

    const invalid = {
      ...candidate,
      appraisals: [
        {
          ...candidate.appraisals[0],
          appraisal: "",
        },
      ],
    };
    expect(validateExperienceCandidate(invalid)).toBe(false);
  });
});
