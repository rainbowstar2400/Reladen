import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sbServer: vi.fn(),
  getUserOrThrow: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  sbServer: mocks.sbServer,
}));

vi.mock('@/lib/supabase/get-user', () => ({
  getUserOrThrow: mocks.getUserOrThrow,
}));

let GET: typeof import('@/app/api/consults/[id]/route').GET;

function makeEventsBuilder(result: { data: any; error: any }) {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.single = vi.fn().mockResolvedValue(result);
  return builder;
}

function makeConsultAnswersBuilder(result: { data: any; error: any }) {
  const builder: any = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  return builder;
}

describe('GET /api/consults/[id]', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.getUserOrThrow.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' });
    mocks.sbServer.mockReturnValue({
      from: mocks.from,
    });

    if (!GET) {
      ({ GET } = await import('@/app/api/consults/[id]/route'));
    }
  });

  it('consult と answer を返す（owner_id フィルタ付き）', async () => {
    const consultId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const userId = '11111111-1111-4111-8111-111111111111';
    let eventsBuilder: any;
    let consultAnswersBuilder: any;

    mocks.from.mockImplementation((table: string) => {
      if (table === 'events') {
        eventsBuilder = makeEventsBuilder({
          data: {
            id: consultId,
            kind: 'consult',
            owner_id: userId,
            updated_at: '2026-03-14T10:00:00.000Z',
            payload: {
              title: '相談タイトル',
              text: 'どうしたらいい？',
              speaker: 'resident_A',
              choices: [{ id: 'c1', label: 'A案' }],
            },
          },
          error: null,
        });
        return eventsBuilder;
      }
      if (table === 'consult_answers') {
        consultAnswersBuilder = makeConsultAnswersBuilder({
          data: {
            id: consultId,
            owner_id: userId,
            selected_choice_id: 'c1',
            decided_at: '2026-03-14T10:05:00.000Z',
            updated_at: '2026-03-14T10:05:00.000Z',
          },
          error: null,
        });
        return consultAnswersBuilder;
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const res = await GET(new Request(`http://localhost/api/consults/${consultId}`), {
      params: { id: consultId },
    } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.consult.id).toBe(consultId);
    expect(body.answer.selectedChoiceId).toBe('c1');
    expect(body.answer.decidedAt).toBe('2026-03-14T10:05:00.000Z');
    expect(eventsBuilder.eq).toHaveBeenCalledWith('owner_id', userId);
    expect(consultAnswersBuilder.eq).toHaveBeenCalledWith('owner_id', userId);
  });

  it('未認証リクエストは 401 を返す', async () => {
    const consultId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    mocks.getUserOrThrow.mockRejectedValue(new Error('No authenticated user found'));

    const res = await GET(new Request(`http://localhost/api/consults/${consultId}`), {
      params: { id: consultId },
    } as any);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'unauthenticated' });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('他ユーザーの consult は 404 を返す（owner_id フィルタで取得不可）', async () => {
    const consultId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    let eventsBuilder: any;

    mocks.from.mockImplementation((table: string) => {
      if (table === 'events') {
        eventsBuilder = makeEventsBuilder({
          data: null,
          error: { message: 'The result contains 0 rows' },
        });
        return eventsBuilder;
      }
      throw new Error(`unexpected table: ${table}`);
    });

    const res = await GET(new Request(`http://localhost/api/consults/${consultId}`), {
      params: { id: consultId },
    } as any);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('0 rows');
    expect(eventsBuilder.eq).toHaveBeenCalledWith('owner_id', '11111111-1111-4111-8111-111111111111');
  });
});
