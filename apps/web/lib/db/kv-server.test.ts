import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  sbServer: () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  }),
}));

import { KvUnauthenticatedError, getKV, getRawKV, putKV } from "@/lib/db/kv-server";

describe("putKV", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getUser.mockResolvedValue({
      data: {
        user: { id: "11111111-1111-4111-8111-111111111111" },
      },
      error: null,
    });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.eq.mockImplementation(() => ({
      eq: mocks.eq,
      maybeSingle: mocks.maybeSingle,
    }));
    mocks.select.mockImplementation(() => ({
      eq: mocks.eq,
      maybeSingle: mocks.maybeSingle,
    }));
    mocks.from.mockReturnValue({
      upsert: mocks.upsert,
      select: mocks.select,
    });
  });

  it("events 保存時に owner_id を自動付与する", async () => {
    await putKV("events", {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      kind: "system",
      payload: { text: "hello" },
      updated_at: "2026-01-01T09:00:00.000Z",
      deleted: false,
    });

    expect(mocks.from).toHaveBeenCalledWith("events");
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_id: "11111111-1111-4111-8111-111111111111",
      }),
      { onConflict: "id" },
    );
  });

  it("認証ユーザー未取得なら KvUnauthenticatedError を投げる", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(
      putKV("events", {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        kind: "system",
        payload: { text: "hello" },
        updated_at: "2026-01-01T09:00:00.000Z",
        deleted: false,
      }),
    ).rejects.toBeInstanceOf(KvUnauthenticatedError);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

describe("getKV / getRawKV", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eq.mockImplementation(() => ({
      eq: mocks.eq,
      maybeSingle: mocks.maybeSingle,
    }));
    mocks.select.mockImplementation(() => ({
      eq: mocks.eq,
      maybeSingle: mocks.maybeSingle,
    }));
    mocks.from.mockReturnValue({
      select: mocks.select,
    });
  });

  it("getKV は deleted=false 条件付きで取得する", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", deleted: false },
      error: null,
    });

    const result = await getKV("residents", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

    expect(result).toEqual({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", deleted: false });
    expect(mocks.eq).toHaveBeenNthCalledWith(1, "id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(mocks.eq).toHaveBeenNthCalledWith(2, "deleted", false);
  });

  it("getRawKV は deleted 条件なしで取得する", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", deleted: true },
      error: null,
    });

    const result = await getRawKV("events", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

    expect(result).toEqual({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", deleted: true });
    expect(mocks.eq).toHaveBeenCalledTimes(1);
    expect(mocks.eq).toHaveBeenCalledWith("id", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });
});
