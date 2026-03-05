import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

let POST: typeof import('@/app/api/sync/[table]/route').POST;

describe('POST /api/sync/[table]', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    mocks.getUser.mockResolvedValue({
      data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
      error: null,
    });
    mocks.upsert.mockResolvedValue({
      error: {
        message: 'new row violates row-level security policy (USING expression) for table "presets"',
      },
    });
    mocks.from.mockReturnValue({
      upsert: mocks.upsert,
    });
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });

    if (!POST) {
      ({ POST } = await import('@/app/api/sync/[table]/route'));
    }
  });

  it('row-level を含むRLSエラーを 401 として返す', async () => {
    const req = new Request('http://localhost/api/sync/presets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({
        table: 'presets',
        changes: [
          {
            data: {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              category: 'speech',
              label: 'テスト',
              updated_at: '2026-01-01T00:00:00.000Z',
              deleted: false,
            },
            updated_at: '2026-01-01T00:00:00.000Z',
            deleted: false,
          },
        ],
      }),
    });

    const res = await POST(req as any, { params: { table: 'presets' } } as any);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.message).toContain('upsert failed');
    expect(data.message).toContain('row-level security policy');
  });
});
