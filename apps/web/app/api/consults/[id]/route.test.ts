import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
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
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    if (!GET) {
      ({ GET } = await import('@/app/api/consults/[id]/route'));
    }
  });

  it('consult と answer を返す（snake_case answer）', async () => {
    const consultId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    mocks.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return makeEventsBuilder({
          data: {
            id: consultId,
            kind: 'consult',
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
      }
      if (table === 'consult_answers') {
        return makeConsultAnswersBuilder({
          data: {
            id: consultId,
            selected_choice_id: 'c1',
            decided_at: '2026-03-14T10:05:00.000Z',
            updated_at: '2026-03-14T10:05:00.000Z',
          },
          error: null,
        });
      }
      throw new Error(`unexpected table: ${table}`);
    });

    mocks.createClient.mockReturnValue({
      from: mocks.from,
    });

    const res = await GET(new Request(`http://localhost/api/consults/${consultId}`), {
      params: { id: consultId },
    } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.consult.id).toBe(consultId);
    expect(body.answer.selectedChoiceId).toBe('c1');
    expect(body.answer.decidedAt).toBe('2026-03-14T10:05:00.000Z');
  });

  it('answer が無い場合は null を返す', async () => {
    const consultId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    mocks.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return makeEventsBuilder({
          data: {
            id: consultId,
            kind: 'consult',
            updated_at: '2026-03-14T11:00:00.000Z',
            payload: {
              title: '相談タイトル',
              text: 'どうしたらいい？',
              speaker: 'resident_B',
              choices: [{ id: 'c2', label: 'B案' }],
            },
          },
          error: null,
        });
      }
      if (table === 'consult_answers') {
        return makeConsultAnswersBuilder({
          data: null,
          error: null,
        });
      }
      throw new Error(`unexpected table: ${table}`);
    });

    mocks.createClient.mockReturnValue({
      from: mocks.from,
    });

    const res = await GET(new Request(`http://localhost/api/consults/${consultId}`), {
      params: { id: consultId },
    } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.consult.id).toBe(consultId);
    expect(body.answer).toBeNull();
  });
});

