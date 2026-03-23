import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listKV: vi.fn(),
  putKV: vi.fn(),
  newId: vi.fn(),
  create: vi.fn(),
  propagateKnowledgeBatch: vi.fn(),
}));

vi.mock('@/env', () => ({
  env: {
    OPENAI_API_KEY: 'test-key',
  },
}));

vi.mock('@/lib/db/kv-server', () => ({
  listKV: mocks.listKV,
  putKV: mocks.putKV,
}));

vi.mock('@/lib/newId', () => ({
  newId: mocks.newId,
}));

vi.mock('openai', () => ({
  default: class OpenAI {
    responses = {
      create: mocks.create,
    };
  },
}));

vi.mock('@repo/shared/logic/knowledge-propagation', () => ({
  propagateKnowledgeBatch: mocks.propagateKnowledgeBatch,
}));

import { generateRecentEventsIfStale } from '@/lib/batch/generate-recent-events';

const RESIDENT_ID = '11111111-1111-4111-8111-111111111111';

describe('generateRecentEventsIfStale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let sequence = 0;
    mocks.newId.mockImplementation(() => {
      sequence += 1;
      return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
    });
    mocks.putKV.mockResolvedValue(undefined);
    mocks.propagateKnowledgeBatch.mockReturnValue({
      newKnowledge: [],
      propagated: [],
    });
    mocks.listKV.mockImplementation(async (table: string) => {
      if (table === 'recent_events') return [];
      if (table === 'residents') {
        return [
          {
            id: RESIDENT_ID,
            name: '住人A',
            interests: ['読書'],
            traits: {
              sociability: 3,
              empathy: 3,
              stubbornness: 3,
              activity: 3,
              expressiveness: 3,
            },
            deleted: false,
          },
        ];
      }
      if (table === 'presets') return [];
      if (table === 'relations') return [];
      return [];
    });
    mocks.create.mockResolvedValue({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({
                events: [{ characterId: RESIDENT_ID, fact: '最近、駅前で新しい店を見つけた。' }],
              }),
            },
          ],
        },
      ],
    });
  });

  it('recent_events 生成時に gpt-5-mini を使って呼び出す', async () => {
    const created = await generateRecentEventsIfStale();

    expect(created).toBe(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const requestArg = mocks.create.mock.calls[0]?.[0];
    expect(requestArg?.model).toBe('gpt-5-mini');
    expect(requestArg?.temperature).toBe(0.7);
  });
});
