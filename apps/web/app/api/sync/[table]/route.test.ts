import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  in: vi.fn(),
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

function makeGenericTableFromMock() {
  return {
    upsert: mocks.upsert,
    insert: mocks.insert,
    select: (columns?: string) => {
      if (columns === 'id,updated_at') return { in: mocks.in };
      return { gte: mocks.gte };
    },
  };
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
    mocks.in.mockResolvedValue({ data: [], error: null });

    if (!POST) {
      ({ POST } = await import('@/app/api/sync/[table]/route'));
    }
  });

  it('consult_answers を初回 insert できる（owner_id を注入する）', async () => {
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
    const data = await res.json();

    const payload = mocks.insert.mock.calls[0][0];
    expect(payload.owner_id).toBe('11111111-1111-4111-8111-111111111111');
    expect(payload.id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(payload.updated_at).toBe('2026-03-14T00:00:00.000Z');
    expect(payload.selected_choice_id).toBe('choice_1');
    expect(payload.decided_at).toBe('2026-03-14T00:00:00.000Z');
    expect(data.pushResult.consumedIndexes).toEqual([0]);
    expect(data.pushResult.rejected).toEqual([]);
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
    const data = await res.json();
    expect(data.pushResult.consumedIndexes).toEqual([0]);
    expect(data.pushResult.rejected).toEqual([]);
  });

  it('camelCase 入力を受理し、snake_case 列へ正規化して insert する', async () => {
    mocks.insert.mockResolvedValue({ error: null });
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
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    const payload = mocks.insert.mock.calls[0][0];
    expect(payload.selected_choice_id).toBe('choice_3');
    expect(payload.decided_at).toBe('2026-03-14T02:00:00.000Z');
    expect(payload.owner_id).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('consult_answers insert の RLS エラーを 401 として返す', async () => {
    mocks.insert.mockResolvedValue({
      error: {
        message: 'new row violates row-level security policy (USING expression) for table "consult_answers"',
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
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            selectedChoiceId: 'choice_4',
            decidedAt: '2026-03-14T03:00:00.000Z',
            updated_at: '2026-03-14T03:00:00.000Z',
            deleted: false,
          },
          updated_at: '2026-03-14T03:00:00.000Z',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'consult_answers' } } as any);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.message).toContain('insert failed');
    expect(data.message).toContain('row-level security policy');
  });

  it('consult_answers insert の非認可エラーを 400 として返す', async () => {
    mocks.insert.mockResolvedValue({
      error: {
        message: 'invalid input syntax for type uuid: "not-a-uuid"',
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
            id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            selectedChoiceId: 'choice_5',
            decidedAt: '2026-03-14T04:00:00.000Z',
            updated_at: '2026-03-14T04:00:00.000Z',
            deleted: false,
          },
          updated_at: '2026-03-14T04:00:00.000Z',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'consult_answers' } } as any);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.message).toContain('insert failed');
    expect(data.message).toContain('invalid input syntax');
  });

  it('row-level を含むRLSエラーを 401 として返す', async () => {
    mocks.upsert.mockResolvedValue({
      error: {
        message: 'new row violates row-level security policy (USING expression) for table "presets"',
      },
    });
    mocks.from.mockImplementation((_table: string) => makeGenericTableFromMock());

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

  it('LWW: クラウドより古い updated_at は upsert しない（巻き戻し防止）', async () => {
    mocks.in.mockResolvedValue({
      data: [{ id: '99999999-9999-4999-8999-999999999999', updated_at: '2026-01-02T00:00:00.000Z' }],
      error: null,
    });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((_table: string) => makeGenericTableFromMock());

    const req = makeRequest('presets', {
      changes: [
        {
          data: {
            id: '99999999-9999-4999-8999-999999999999',
            category: 'speech',
            label: '古い更新',
            updated_at: '2026-01-01T00:00:00.000Z',
            deleted: false,
          },
          updated_at: '2026-01-01T00:00:00.000Z',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'presets' } } as any);
    expect(res.status).toBe(200);
    expect(mocks.upsert).not.toHaveBeenCalled();
    const data = await res.json();
    expect(data.pushResult.consumedIndexes).toEqual([0]);
    expect(data.pushResult.rejected).toEqual([]);
  });

  it('LWW: クラウドより新しい updated_at は upsert する', async () => {
    mocks.in.mockResolvedValue({
      data: [{ id: '88888888-8888-4888-8888-888888888888', updated_at: '2026-01-01T00:00:00.000Z' }],
      error: null,
    });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((_table: string) => makeGenericTableFromMock());

    const req = makeRequest('presets', {
      changes: [
        {
          data: {
            id: '88888888-8888-4888-8888-888888888888',
            category: 'speech',
            label: '新しい更新',
            updated_at: '2026-01-02T00:00:00.000Z',
            deleted: false,
          },
          updated_at: '2026-01-02T00:00:00.000Z',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'presets' } } as any);
    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0][0][0].updated_at).toBe('2026-01-02T00:00:00.000Z');
  });

  it('LWW: updated_at が同値なら既存優先 no-op にする', async () => {
    mocks.in.mockResolvedValue({
      data: [{ id: '77777777-7777-4777-8777-777777777777', updated_at: '2026-01-02T00:00:00.000Z' }],
      error: null,
    });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((_table: string) => makeGenericTableFromMock());

    const req = makeRequest('presets', {
      changes: [
        {
          data: {
            id: '77777777-7777-4777-8777-777777777777',
            category: 'speech',
            label: '同値更新',
            updated_at: '2026-01-02T00:00:00.000Z',
            deleted: false,
          },
          updated_at: '2026-01-02T00:00:00.000Z',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'presets' } } as any);
    expect(res.status).toBe(200);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('LWW: data.updated_at 欠落時は change.updated_at を補完して比較する', async () => {
    mocks.in.mockResolvedValue({
      data: [{ id: '66666666-6666-4666-8666-666666666666', updated_at: '2026-01-01T00:00:00.000Z' }],
      error: null,
    });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((_table: string) => makeGenericTableFromMock());

    const req = makeRequest('presets', {
      changes: [
        {
          data: {
            id: '66666666-6666-4666-8666-666666666666',
            category: 'speech',
            label: '補完テスト',
            deleted: false,
          },
          updated_at: '2026-01-03T00:00:00.000Z',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'presets' } } as any);
    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0][0][0].updated_at).toBe('2026-01-03T00:00:00.000Z');
  });

  it('10件中1件の invalid updated_at は rejected し、他は処理を継続する', async () => {
    mocks.in.mockResolvedValue({ data: [], error: null });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((_table: string) => makeGenericTableFromMock());

    const changes = Array.from({ length: 10 }, (_, index) => ({
      data: {
        id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${index.toString().padStart(2, '0')}`,
        category: 'speech',
        label: `label-${index}`,
        updated_at: index === 4 ? 'not-a-date' : `2026-03-${(index + 1).toString().padStart(2, '0')}T00:00:00.000Z`,
        deleted: false,
      },
      updated_at: index === 4 ? 'not-a-date' : `2026-03-${(index + 1).toString().padStart(2, '0')}T00:00:00.000Z`,
      deleted: false,
    }));

    const req = makeRequest('presets', { changes });
    const res = await POST(req as any, { params: { table: 'presets' } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0][0]).toHaveLength(9);
    expect(data.pushResult.consumedIndexes).toEqual([0, 1, 2, 3, 5, 6, 7, 8, 9]);
    expect(data.pushResult.rejected).toEqual([
      {
        index: 4,
        reason: 'invalid_updated_at',
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04',
      },
    ]);
  });

  it('全件 invalid updated_at の場合は 200 + rejected のみを返す', async () => {
    mocks.in.mockResolvedValue({ data: [], error: null });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((_table: string) => makeGenericTableFromMock());

    const req = makeRequest('presets', {
      changes: [
        {
          data: {
            id: 'b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0',
            category: 'speech',
            label: 'invalid-1',
            updated_at: '',
            deleted: false,
          },
          updated_at: '',
          deleted: false,
        },
        {
          data: {
            id: 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1',
            category: 'speech',
            label: 'invalid-2',
            updated_at: '',
            deleted: false,
          },
          updated_at: '',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'presets' } } as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(data.pushResult.consumedIndexes).toEqual([]);
    expect(data.pushResult.rejected).toEqual([
      {
        index: 0,
        reason: 'invalid_updated_at',
        id: 'b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0',
      },
      {
        index: 1,
        reason: 'invalid_updated_at',
        id: 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1',
      },
    ]);
  });

  it('同期許可列: residents.nicknameTendency を nickname_tendency として upsert する', async () => {
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((_table: string) => makeGenericTableFromMock());

    const req = makeRequest('residents', {
      changes: [
        {
          data: {
            id: '10101010-1010-4101-8101-101010101010',
            name: 'Alice',
            nicknameTendency: 'nickname',
            updated_at: '2026-03-15T00:00:00.000Z',
            deleted: false,
          },
          updated_at: '2026-03-15T00:00:00.000Z',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'residents' } } as any);
    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0][0][0].nickname_tendency).toBe('nickname');
  });

  it('同期許可列: relations.familySubType を family_sub_type として upsert する', async () => {
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((_table: string) => makeGenericTableFromMock());

    const req = makeRequest('relations', {
      changes: [
        {
          data: {
            id: '20202020-2020-4202-8202-202020202020',
            aId: '11111111-1111-4111-8111-111111111111',
            bId: '22222222-2222-4222-8222-222222222222',
            type: 'family',
            familySubType: 'sister',
            updated_at: '2026-03-15T01:00:00.000Z',
            deleted: false,
          },
          updated_at: '2026-03-15T01:00:00.000Z',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'relations' } } as any);
    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0][0][0].family_sub_type).toBe('sister');
  });

  it('同期許可列: feelings の拡張列を snake_case として upsert する', async () => {
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((_table: string) => makeGenericTableFromMock());

    const req = makeRequest('feelings', {
      changes: [
        {
          data: {
            id: '30303030-3030-4303-8303-303030303030',
            fromId: '11111111-1111-4111-8111-111111111111',
            toId: '22222222-2222-4222-8222-222222222222',
            label: 'like',
            score: 42,
            recentDeltas: [3, -1, 2],
            lastContactedAt: '2026-03-15T02:00:00.000Z',
            baseLabel: 'like',
            specialLabel: null,
            baseBeforeSpecial: 'curious',
            updated_at: '2026-03-15T02:00:01.000Z',
            deleted: false,
          },
          updated_at: '2026-03-15T02:00:01.000Z',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'feelings' } } as any);
    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0][0][0].recent_deltas).toEqual([3, -1, 2]);
    expect(mocks.upsert.mock.calls[0][0][0].last_contacted_at).toBe('2026-03-15T02:00:00.000Z');
    expect(mocks.upsert.mock.calls[0][0][0].base_label).toBe('like');
    expect(mocks.upsert.mock.calls[0][0][0].special_label).toBe(null);
    expect(mocks.upsert.mock.calls[0][0][0].base_before_special).toBe('curious');
  });

  it('同期許可列: nicknames.locked を upsert する', async () => {
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((_table: string) => makeGenericTableFromMock());

    const req = makeRequest('nicknames', {
      changes: [
        {
          data: {
            id: '40404040-4040-4404-8404-404040404040',
            fromId: '11111111-1111-4111-8111-111111111111',
            toId: '22222222-2222-4222-8222-222222222222',
            nickname: 'Aちゃん',
            locked: true,
            updated_at: '2026-03-15T03:00:00.000Z',
            deleted: false,
          },
          updated_at: '2026-03-15T03:00:00.000Z',
          deleted: false,
        },
      ],
    });

    const res = await POST(req as any, { params: { table: 'nicknames' } } as any);
    expect(res.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert.mock.calls[0][0][0].locked).toBe(true);
  });
});
