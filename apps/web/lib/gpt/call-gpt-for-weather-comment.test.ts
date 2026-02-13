import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock('@/env', () => ({
  env: {
    OPENAI_API_KEY: 'test-key',
  },
}));

vi.mock('openai', () => ({
  default: class OpenAI {
    responses = {
      create: mocks.create,
    };
  },
}));

import { callGptForWeatherComment } from '@/lib/gpt/call-gpt-for-weather-comment';

const resident = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'ハル',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted: false,
};

describe('callGptForWeatherComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('output_text が文字列でも全文を返す', async () => {
    mocks.create.mockResolvedValueOnce({
      output_text: '雨の音って落ち着くね。今日は部屋でのんびりしようかな。',
    });

    const text = await callGptForWeatherComment({
      resident: resident as any,
      weatherKind: 'rain',
      now: new Date('2026-02-13T00:00:00.000Z'),
    });

    expect(text).toBe('雨の音って落ち着くね。今日は部屋でのんびりしようかな。');
  });

  it('output からもテキスト抽出できる', async () => {
    mocks.create.mockResolvedValueOnce({
      output_text: '',
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: '気持ちのいい天気だね。少し散歩したくなるな。',
            },
          ],
        },
      ],
    });

    const text = await callGptForWeatherComment({
      resident: resident as any,
      weatherKind: 'sunny',
      now: new Date('2026-02-13T00:00:00.000Z'),
    });

    expect(text).toBe('気持ちのいい天気だね。少し散歩したくなるな。');
  });
});
