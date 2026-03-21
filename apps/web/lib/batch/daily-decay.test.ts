import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

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

import { runDailyDecay } from "@/lib/batch/daily-decay";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";

describe("runDailyDecay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-21T00:00:00.000Z"));
    vi.clearAllMocks();
    mocks.newId.mockReturnValue("99999999-9999-4999-8999-999999999999");
    mocks.putKV.mockResolvedValue(undefined);
    mocks.listKV.mockImplementation(async (table: string) => {
      if (table === "feelings") {
        return [
          {
            id: "f1",
            from_id: A_ID,
            to_id: B_ID,
            label: "awkward",
            base_label: "maybe_like",
            special_label: "awkward",
            base_before_special: "love",
            score: 50,
            last_contacted_at: "2026-03-10T00:00:00.000Z",
            updated_at: "2026-03-10T00:00:00.000Z",
            deleted: false,
          },
        ];
      }
      if (table === "relations") {
        return [
          {
            a_id: A_ID,
            b_id: B_ID,
            type: "friend",
            deleted: false,
          },
        ];
      }
      return [];
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("awkward 回復時は base_before_special を優先して復元する", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const result = await runDailyDecay();

    expect(result).toEqual({ processed: 1, updated: 1, transitioned: 0 });
    const feelingWrite = mocks.putKV.mock.calls.find((call) => call[0] === "feelings")?.[1] as Record<string, unknown>;
    expect(feelingWrite).toBeTruthy();
    expect(feelingWrite.score).toBe(48);
    expect(feelingWrite.label).toBe("love");
    expect(feelingWrite.base_label).toBe("love");
    expect(feelingWrite.special_label).toBe(null);
    expect(feelingWrite.base_before_special).toBe(null);
  });

  it("awkward を維持する場合は base_before_special を保持する", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);

    const result = await runDailyDecay();

    expect(result).toEqual({ processed: 1, updated: 1, transitioned: 0 });
    const feelingWrite = mocks.putKV.mock.calls.find((call) => call[0] === "feelings")?.[1] as Record<string, unknown>;
    expect(feelingWrite).toBeTruthy();
    expect(feelingWrite.score).toBe(48);
    expect(feelingWrite.label).toBe("awkward");
    expect(feelingWrite.base_label).toBe("maybe_like");
    expect(feelingWrite.special_label).toBe("awkward");
    expect(feelingWrite.base_before_special).toBe("love");
  });
});
