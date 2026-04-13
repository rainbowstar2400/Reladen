import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runDailyDecay: vi.fn(),
  MockKvUnauthenticatedError: class MockKvUnauthenticatedError extends Error {},
}));

vi.mock('@/lib/batch/daily-decay', () => ({
  runDailyDecay: mocks.runDailyDecay,
}));

vi.mock('@/lib/db/kv-server', () => ({
  KvUnauthenticatedError: mocks.MockKvUnauthenticatedError,
}));

import { POST } from '@/app/api/batch/daily-decay/route';

describe('POST /api/batch/daily-decay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未認証時は 401 を返す', async () => {
    mocks.runDailyDecay.mockRejectedValueOnce(new mocks.MockKvUnauthenticatedError('auth'));

    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: 'unauthenticated' });
  });

  it('正常系では処理結果を返す', async () => {
    mocks.runDailyDecay.mockResolvedValueOnce({
      processed: 3,
      updated: 2,
      transitioned: 1,
    });

    const res = await POST();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      processed: 3,
      updated: 2,
      transitioned: 1,
    });
  });
});
