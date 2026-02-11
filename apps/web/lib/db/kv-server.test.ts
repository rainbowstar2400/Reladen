import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  sbServer: () => ({
    auth: {
      getUser: mocks.getUser,
    },
    from: mocks.from,
  }),
}));

import { KvUnauthenticatedError, putKV } from "@/lib/db/kv-server";

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
    mocks.from.mockReturnValue({
      upsert: mocks.upsert,
    });
  });

  it("beliefs 保存時に owner_id を自動付与する", async () => {
    await putKV("beliefs", {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      resident_id: "22222222-2222-4222-8222-222222222222",
      world_facts: [],
      person_knowledge: {},
      updated_at: "2026-01-01T09:00:00.000Z",
      deleted: false,
    });

    expect(mocks.from).toHaveBeenCalledWith("beliefs");
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
      putKV("beliefs", {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        resident_id: "22222222-2222-4222-8222-222222222222",
        world_facts: [],
        person_knowledge: {},
        updated_at: "2026-01-01T09:00:00.000Z",
        deleted: false,
      }),
    ).rejects.toBeInstanceOf(KvUnauthenticatedError);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

