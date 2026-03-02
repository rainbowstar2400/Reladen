import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listLocal: vi.fn(),
  selectConversationCandidates: vi.fn(),
}));

vi.mock("@/lib/db-local", () => ({
  listLocal: mocks.listLocal,
}));

vi.mock("@/lib/conversation/candidates", () => ({
  selectConversationCandidates: mocks.selectConversationCandidates,
}));

import { startConversationScheduler, triggerConversationNow } from "@/lib/scheduler/conversation-scheduler";

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
  };
}

function installBrowserLikeGlobals() {
  const localStorage = createMemoryStorage();
  const listeners = new Map<string, Set<() => void>>();

  const document = {
    hidden: false,
    addEventListener: (event: string, handler: () => void) => {
      const set = listeners.get(event) ?? new Set<() => void>();
      set.add(handler);
      listeners.set(event, set);
    },
    removeEventListener: (event: string, handler: () => void) => {
      const set = listeners.get(event);
      if (!set) return;
      set.delete(handler);
      if (set.size === 0) listeners.delete(event);
    },
  };

  (globalThis as any).window = {
    setTimeout,
    clearTimeout,
    localStorage,
  };
  (globalThis as any).document = document;
  (globalThis as any).localStorage = localStorage;
}

let fetchMock: ReturnType<typeof vi.fn>;

function createFetchResponse(input: {
  ok: boolean;
  status?: number;
  body?: unknown;
}) {
  const status = input.status ?? (input.ok ? 200 : 500);
  const bodyText = typeof input.body === "string"
    ? input.body
    : JSON.stringify(input.body ?? {});
  return {
    ok: input.ok,
    status,
    text: async () => bodyText,
    json: async () => {
      try {
        return JSON.parse(bodyText);
      } catch {
        return bodyText;
      }
    },
  };
}

describe("conversation scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    installBrowserLikeGlobals();

    mocks.listLocal.mockImplementation(async (table: string) => {
      switch (table) {
        case "residents":
          return [
            { id: "resident_A", name: "A", deleted: false },
            { id: "resident_B", name: "B", deleted: false },
          ];
        case "presets":
        case "relations":
        case "topic_threads":
          return [];
        default:
          return [];
      }
    });

    mocks.selectConversationCandidates.mockImplementation(
      (_now: Date, residents: Array<{ id: string }>) => residents,
    );

    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "{}",
      json: async () => ({}),
    });
    (globalThis as any).fetch = fetchMock;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (globalThis as any).window;
    delete (globalThis as any).document;
    delete (globalThis as any).localStorage;
    delete (globalThis as any).fetch;
  });

  it("早期return経路でもタイマーが増殖しない", async () => {
    mocks.selectConversationCandidates.mockReturnValue([]);
    const scheduler = startConversationScheduler({ baseIntervalMs: 10_000 });

    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(vi.getTimerCount()).toBe(1);

    scheduler.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("複数起動でも最短間隔内の会話生成は1回だけ", async () => {
    const s1 = startConversationScheduler({ baseIntervalMs: 900_000 });

    // 2つ目のタブ起動を模擬（同じlocalStorageを共有）
    await vi.advanceTimersByTimeAsync(300_000);
    const s2 = startConversationScheduler({ baseIntervalMs: 900_000 });

    // 1つ目の初回実行（720,000ms）
    await vi.advanceTimersByTimeAsync(420_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 2つ目の初回実行（1,020,000ms）は最短間隔未満のためスキップ
    await vi.advanceTimersByTimeAsync(300_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    s1.stop();
    s2.stop();
  });

  it("手動発火(force)は最短間隔内でも会話生成を実行できる", async () => {
    const now = Date.now();
    (globalThis as any).localStorage.setItem("reladen:conv-scheduler:last-run", String(now));

    const result = await triggerConversationNow({
      force: true,
      baseIntervalMs: 900_000,
    });

    expect(result.status).toBe("started");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body ?? "{}");
    expect(body).toEqual({ participants: ["resident_A", "resident_B"] });
  });

  it("手動発火(forceなし)は最短間隔内だと skipped を返す", async () => {
    const now = Date.now();
    (globalThis as any).localStorage.setItem("reladen:conv-scheduler:last-run", String(now));

    const result = await triggerConversationNow({
      force: false,
      baseIntervalMs: 900_000,
    });

    expect(result).toMatchObject({ status: "skipped", reason: "recently_ran" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("既存スレッドがある場合は threadId のみを送信する", async () => {
    mocks.listLocal.mockImplementation(async (table: string) => {
      switch (table) {
        case "residents":
          return [
            { id: "resident_A", name: "A", deleted: false },
            { id: "resident_B", name: "B", deleted: false },
          ];
        case "relations":
          return [];
        case "topic_threads":
          return [
            {
              id: "thread_1",
              participants: ["resident_A", "resident_B"],
              status: "ongoing",
              updated_at: "2026-01-01T00:00:00.000Z",
              deleted: false,
            },
          ];
        default:
          return [];
      }
    });

    const result = await triggerConversationNow({
      force: true,
      baseIntervalMs: 900_000,
    });

    expect(result.status).toBe("started");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body ?? "{}");
    expect(body).toEqual({ threadId: "thread_1" });
  });

  it("thread_not_found の場合は participants で再試行する", async () => {
    mocks.listLocal.mockImplementation(async (table: string) => {
      switch (table) {
        case "residents":
          return [
            { id: "resident_A", name: "A", deleted: false },
            { id: "resident_B", name: "B", deleted: false },
          ];
        case "relations":
          return [];
        case "topic_threads":
          return [
            {
              id: "thread_1",
              participants: ["resident_A", "resident_B"],
              status: "ongoing",
              updated_at: "2026-01-01T00:00:00.000Z",
              deleted: false,
            },
          ];
        default:
          return [];
      }
    });

    fetchMock
      .mockResolvedValueOnce(
        createFetchResponse({
          ok: false,
          status: 404,
          body: { error: "thread_not_found" },
        }),
      )
      .mockResolvedValueOnce(createFetchResponse({ ok: true, body: {} }));

    const result = await triggerConversationNow({
      force: true,
      baseIntervalMs: 900_000,
    });

    expect(result).toMatchObject({
      status: "started",
      threadId: undefined,
      participants: ["resident_A", "resident_B"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")).toEqual({
      threadId: "thread_1",
    });
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body ?? "{}")).toEqual({
      participants: ["resident_A", "resident_B"],
    });
  });

  it("invalid_thread_participants の場合は participants で再試行する", async () => {
    mocks.listLocal.mockImplementation(async (table: string) => {
      switch (table) {
        case "residents":
          return [
            { id: "resident_A", name: "A", deleted: false },
            { id: "resident_B", name: "B", deleted: false },
          ];
        case "relations":
          return [];
        case "topic_threads":
          return [
            {
              id: "thread_1",
              participants: ["resident_A", "resident_B"],
              status: "ongoing",
              updated_at: "2026-01-01T00:00:00.000Z",
              deleted: false,
            },
          ];
        default:
          return [];
      }
    });

    fetchMock
      .mockResolvedValueOnce(
        createFetchResponse({
          ok: false,
          status: 400,
          body: { error: "invalid_thread_participants" },
        }),
      )
      .mockResolvedValueOnce(createFetchResponse({ ok: true, body: {} }));

    const result = await triggerConversationNow({
      force: true,
      baseIntervalMs: 900_000,
    });

    expect(result).toMatchObject({
      status: "started",
      threadId: undefined,
      participants: ["resident_A", "resident_B"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")).toEqual({
      threadId: "thread_1",
    });
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body ?? "{}")).toEqual({
      participants: ["resident_A", "resident_B"],
    });
  });

  it("再試行も失敗した場合は代替ペアで継続する", async () => {
    mocks.listLocal.mockImplementation(async (table: string) => {
      switch (table) {
        case "residents":
          return [
            { id: "resident_A", name: "A", deleted: false },
            { id: "resident_B", name: "B", deleted: false },
            { id: "resident_C", name: "C", deleted: false },
          ];
        case "relations":
          return [];
        case "topic_threads":
          return [
            {
              id: "thread_1",
              participants: ["resident_A", "resident_B"],
              status: "ongoing",
              updated_at: "2026-01-01T00:00:00.000Z",
              deleted: false,
            },
          ];
        default:
          return [];
      }
    });

    fetchMock
      .mockResolvedValueOnce(
        createFetchResponse({
          ok: false,
          status: 404,
          body: { error: "thread_not_found" },
        }),
      )
      .mockResolvedValueOnce(
        createFetchResponse({
          ok: false,
          status: 500,
          body: { error: "conversation_failed" },
        }),
      )
      .mockResolvedValueOnce(createFetchResponse({ ok: true, body: {} }));

    const result = await triggerConversationNow({
      force: true,
      baseIntervalMs: 900_000,
    });

    expect(result.status).toBe("started");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")).toEqual({
      threadId: "thread_1",
    });
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body ?? "{}")).toEqual({
      participants: ["resident_A", "resident_B"],
    });
    const thirdBody = JSON.parse(fetchMock.mock.calls[2]?.[1]?.body ?? "{}");
    expect(Array.isArray(thirdBody.participants)).toBe(true);
    expect(thirdBody.participants).not.toEqual(["resident_A", "resident_B"]);
  });

  it("再試行失敗かつ代替ペアがない場合でも skipped で返す", async () => {
    mocks.listLocal.mockImplementation(async (table: string) => {
      switch (table) {
        case "residents":
          return [
            { id: "resident_A", name: "A", deleted: false },
            { id: "resident_B", name: "B", deleted: false },
          ];
        case "relations":
          return [];
        case "topic_threads":
          return [
            {
              id: "thread_1",
              participants: ["resident_A", "resident_B"],
              status: "ongoing",
              updated_at: "2026-01-01T00:00:00.000Z",
              deleted: false,
            },
          ];
        default:
          return [];
      }
    });

    fetchMock
      .mockResolvedValueOnce(
        createFetchResponse({
          ok: false,
          status: 404,
          body: { error: "thread_not_found" },
        }),
      )
      .mockResolvedValueOnce(
        createFetchResponse({
          ok: false,
          status: 500,
          body: { error: "conversation_failed" },
        }),
      );

    const result = await triggerConversationNow({
      force: true,
      baseIntervalMs: 900_000,
    });

    expect(result).toEqual({ status: "skipped", reason: "no_target" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
