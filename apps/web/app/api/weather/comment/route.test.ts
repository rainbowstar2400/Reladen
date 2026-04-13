import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateWeatherComment: vi.fn(),
  getUserOrThrow: vi.fn(),
}));

vi.mock('@/lib/weather/generate-weather-comment', () => ({
  generateWeatherComment: mocks.generateWeatherComment,
}));

vi.mock('@/lib/supabase/get-user', () => ({
  getUserOrThrow: mocks.getUserOrThrow,
}));

import { POST } from '@/app/api/weather/comment/route';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/weather/comment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/weather/comment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserOrThrow.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' });
  });

  it('未認証時は 401 を返す', async () => {
    mocks.getUserOrThrow.mockRejectedValue(new Error('No authenticated user found'));

    const res = await POST(
      makeRequest({
        resident: { id: 'resident-1', name: 'A' },
        weatherKind: 'sunny',
        now: '2026-03-20T00:00:00.000Z',
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: 'unauthenticated' });
    expect(mocks.generateWeatherComment).not.toHaveBeenCalled();
  });

  it('不正な payload は 400 を返す', async () => {
    const res = await POST(
      makeRequest({
        resident: { id: 'resident-1', name: 'A' },
        weatherKind: 'sunny',
        now: 'invalid-date',
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: 'invalid_payload' });
    expect(mocks.generateWeatherComment).not.toHaveBeenCalled();
  });

  it('認証済みならコメントを返す', async () => {
    mocks.generateWeatherComment.mockResolvedValue('今日は気持ちいい天気だね。');

    const res = await POST(
      makeRequest({
        resident: { id: 'resident-1', name: 'A' },
        weatherKind: 'sunny',
        now: '2026-03-20T00:00:00.000Z',
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ text: '今日は気持ちいい天気だね。' });
    expect(mocks.generateWeatherComment).toHaveBeenCalledTimes(1);
  });
});
