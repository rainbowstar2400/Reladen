import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  gte: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

let POST: typeof import('@/app/api/sync/[table]/route').POST;

function makeRequest(table: string, body: Record<string, unknown>) {
  return new Request(`http://localhost/api/sync/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token',
    },
    body: JSON.stringify({ table, ...body }),
  });
}

describe('POST /api/sync/[table]', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    mocks.getUser.mockResolvedValue({
      data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
      error: null,
    });

    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    });

    if (!POST) {
      ({ POST } = await import('@/app/api/sync/[table]/route'));
    }
  });

  it('consult_answers を初回 insert できる（owner_id は注入しない）', async () => {
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'consult_answers') {
        return { insert: mocks.insert };
      }
      return { upsert: mocks.upsert, select: mocks.select };
    });

    const req = makeRequest('consult_answers', {
      changes: [
        {
          data: {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            selectedChoiceId: 'choice_1',
            decidedAt: '2026-03-14T00:00:00.000Z',
            updated_at: '2026-03-14T00:00:00.000Z',
            deleted: false,
          },
          updated_at: '2026-03-14T00:00:00.000Z',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'consult_answers' } } as any);
    expect(res.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledTimes(1);

    const payload = mocks.insert.mock.calls[0][0];
    expect(payload.owner_id).toBeUndefined();
    expect(payload.id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(payload.updated_at).toBe('2026-03-14T00:00:00.000Z');
    expect(payload.selected_choice_id ?? payload.selectedchoiceid).toBe('choice_1');
    expect(payload.decided_at ?? payload.decidedat).toBe('2026-03-14T00:00:00.000Z');
  });

  it('consult_answers の重複 insert は no-op 成功にする（first-write-wins）', async () => {
    mocks.insert.mockResolvedValue({
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "consult_answers_pkey"',
      },
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'consult_answers') return { insert: mocks.insert };
      return { upsert: mocks.upsert, select: mocks.select };
    });

    const req = makeRequest('consult_answers', {
      changes: [
        {
          data: {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            selectedChoiceId: 'choice_2',
            decidedAt: '2026-03-14T01:00:00.000Z',
            updated_at: '2026-03-14T01:00:00.000Z',
            deleted: false,
          },
          updated_at: '2026-03-14T01:00:00.000Z',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'consult_answers' } } as any);
    expect(res.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it('snake_case 列が無い環境では compact 列へフォールバックして insert する', async () => {
    mocks.insert
      .mockResolvedValueOnce({
        error: {
          message: 'column "selected_choice_id" of relation "consult_answers" does not exist',
        },
      })
      .mockResolvedValueOnce({ error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'consult_answers') return { insert: mocks.insert };
      return { upsert: mocks.upsert, select: mocks.select };
    });

    const req = makeRequest('consult_answers', {
      changes: [
        {
          data: {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            selectedChoiceId: 'choice_3',
            decidedAt: '2026-03-14T02:00:00.000Z',
            updated_at: '2026-03-14T02:00:00.000Z',
            deleted: false,
          },
          updated_at: '2026-03-14T02:00:00.000Z',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'consult_answers' } } as any);
    expect(res.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledTimes(2);
    const compactPayload = mocks.insert.mock.calls[1][0];
    expect(compactPayload.selectedchoiceid).toBe('choice_3');
    expect(compactPayload.decidedat).toBe('2026-03-14T02:00:00.000Z');
    expect(compactPayload.owner_id).toBeUndefined();
  });

  it('row-level を含むRLSエラーを 401 として返す', async () => {
    mocks.upsert.mockResolvedValue({
      error: {
        message: 'new row violates row-level security policy (USING expression) for table "presets"',
      },
    });
    mocks.from.mockImplementation((_table: string) => ({
      upsert: mocks.upsert,
      insert: mocks.insert,
      select: mocks.select,
    }));

    const req = makeRequest('presets', {
      changes: [
        {
          data: {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            category: 'speech',
            label: 'テスト',
            updated_at: '2026-01-01T00:00:00.000Z',
            deleted: false,
          },
          updated_at: '2026-01-01T00:00:00.000Z',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'presets' } } as any);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.message).toContain('upsert failed');
    expect(data.message).toContain('row-level security policy');
  });
});

