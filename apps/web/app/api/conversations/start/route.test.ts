import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runConversationFromApi: vi.fn(),
  MockConversationStartError: class MockConversationStartError extends Error {
    code: "thread_not_found" | "invalid_thread_participants";
    status: number;

    constructor(code: "thread_not_found" | "invalid_thread_participants", status: number) {
      super(code);
      this.name = "ConversationStartError";
      this.code = code;
      this.status = status;
    }
  },
  MockKvUnauthenticatedError: class MockKvUnauthenticatedError extends Error {},
}));

vi.mock("@/lib/conversation/run-conversation", () => ({
  runConversationFromApi: mocks.runConversationFromApi,
  ConversationStartError: mocks.MockConversationStartError,
}));

vi.mock("@/lib/db/kv-server", () => ({
  KvUnauthenticatedError: mocks.MockKvUnauthenticatedError,
}));

import { POST } from "@/app/api/conversations/start/route";

const A_ID = "11111111-1111-4111-8111-111111111111";
const B_ID = "22222222-2222-4222-8222-222222222222";
const THREAD_ID = "33333333-3333-4333-8333-333333333333";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/conversations/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/conversations/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("`{ threadId }` を受理する", async () => {
    mocks.runConversationFromApi.mockResolvedValue({
      eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      threadId: THREAD_ID,
    });

    const res = await POST(makeRequest({ threadId: THREAD_ID }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      threadId: THREAD_ID,
    });
    expect(mocks.runConversationFromApi).toHaveBeenCalledWith({ threadId: THREAD_ID });
  });

  it("`{ participants }` を受理する", async () => {
    mocks.runConversationFromApi.mockResolvedValue({
      eventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      threadId: THREAD_ID,
    });

    const res = await POST(makeRequest({ participants: [A_ID, B_ID] }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      eventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      threadId: THREAD_ID,
    });
    expect(mocks.runConversationFromApi).toHaveBeenCalledWith({ participants: [A_ID, B_ID] });
  });

  it("`{ threadId, participants }` は 400 invalid_payload を返す", async () => {
    const res = await POST(
      makeRequest({
        threadId: THREAD_ID,
        participants: [A_ID, B_ID],
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("invalid_payload");
    expect(mocks.runConversationFromApi).not.toHaveBeenCalled();
  });

  it("thread が見つからない場合は 404 thread_not_found を返す", async () => {
    mocks.runConversationFromApi.mockRejectedValue(
      new mocks.MockConversationStartError("thread_not_found", 404),
    );

    const res = await POST(makeRequest({ threadId: THREAD_ID }));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data).toEqual({ error: "thread_not_found" });
  });
});
