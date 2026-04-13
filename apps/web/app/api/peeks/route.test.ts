import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listKV: vi.fn(),
  callGptForPeek: vi.fn(),
  MockKvUnauthenticatedError: class MockKvUnauthenticatedError extends Error {},
}));

vi.mock('@/lib/db/kv-server', () => ({
  listKV: mocks.listKV,
  KvUnauthenticatedError: mocks.MockKvUnauthenticatedError,
}));

vi.mock('@/lib/gpt/call-gpt-for-peek', () => ({
  callGptForPeek: mocks.callGptForPeek,
}));

import { POST } from '@/app/api/peeks/route';

const RESIDENT_ID = '11111111-1111-4111-8111-111111111111';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/peeks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/peeks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callGptForPeek.mockResolvedValue({ text: '窓辺で本を読んでいる。' });
  });

  it('未認証時は 401 を返す', async () => {
    mocks.listKV.mockRejectedValueOnce(new mocks.MockKvUnauthenticatedError('auth'));

    const res = await POST(makeRequest({ residentId: RESIDENT_ID }));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: 'unauthenticated' });
  });

  it('住人が見つからない場合は 404 を返す', async () => {
    mocks.listKV.mockResolvedValueOnce([]);

    const res = await POST(makeRequest({ residentId: RESIDENT_ID }));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data).toEqual({ error: 'resident_not_found' });
    expect(mocks.callGptForPeek).not.toHaveBeenCalled();
  });

  it('正常系では peek 結果を返す', async () => {
    const occupationId = '22222222-2222-4222-8222-222222222222';
    mocks.listKV
      .mockResolvedValueOnce([
        {
          id: RESIDENT_ID,
          name: 'アリス',
          gender: 'female',
          age: 20,
          mbti: 'INFP',
          traits: { empathy: 4 },
          interests: ['読書'],
          occupation: occupationId,
          deleted: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: '33333333-3333-4333-8333-333333333333',
          kind: 'conversation',
          deleted: false,
          updated_at: '2026-03-20T00:00:00.000Z',
          payload: {
            participants: [RESIDENT_ID, '44444444-4444-4444-8444-444444444444'],
            lines: [{ speaker: 'アリス', text: '今日は散歩日和だね。' }],
            topic: '散歩',
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: occupationId,
          label: '図書館司書',
          deleted: false,
        },
      ]);

    const res = await POST(
      makeRequest({
        residentId: RESIDENT_ID,
        timeOfDay: '朝',
        weather: 'sunny',
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ text: '窓辺で本を読んでいる。' });
    expect(mocks.callGptForPeek).toHaveBeenCalledWith({
      character: {
        name: 'アリス',
        gender: 'female',
        age: 20,
        occupation: '図書館司書',
        mbti: 'INFP',
        traits: { empathy: 4 },
        interests: ['読書'],
      },
      environment: {
        timeOfDay: '朝',
        weather: 'sunny',
      },
      recentEventSummaries: ['アリス: 今日は散歩日和だね。'],
    });
  });
});
