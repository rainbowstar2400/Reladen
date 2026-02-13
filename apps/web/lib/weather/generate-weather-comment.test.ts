import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callGptForWeatherComment: vi.fn(),
}));

vi.mock('@/lib/gpt/call-gpt-for-weather-comment', () => ({
  callGptForWeatherComment: mocks.callGptForWeatherComment,
}));

import { generateWeatherComment } from '@/lib/weather/generate-weather-comment';

const resident = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'ハル',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted: false,
};

describe('generateWeatherComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('十分なコメントはそのまま返す', async () => {
    mocks.callGptForWeatherComment.mockResolvedValueOnce('雨音が心地いいな。今日はゆっくり過ごそう。');

    const out = await generateWeatherComment({
      resident: resident as any,
      weatherKind: 'rain',
      now: new Date('2026-02-13T00:00:00.000Z'),
    });

    expect(out).toBe('雨音が心地いいな。今日はゆっくり過ごそう。');
  });

  it('天気語だけの短文はフォールバックに置き換える', async () => {
    mocks.callGptForWeatherComment.mockResolvedValueOnce('雨');

    const out = await generateWeatherComment({
      resident: resident as any,
      weatherKind: 'rain',
      now: new Date('2026-02-13T00:00:00.000Z'),
    });

    expect(out).toBe('雨の音って落ち着くね。今日は部屋でのんびりしようかな。');
  });

  it('生成失敗時もフォールバックを返す', async () => {
    mocks.callGptForWeatherComment.mockResolvedValueOnce(null);

    const out = await generateWeatherComment({
      resident: resident as any,
      weatherKind: 'storm',
      now: new Date('2026-02-13T00:00:00.000Z'),
    });

    expect(out).toBe('雷がすごいね。今日は無理せず室内で過ごそう。');
  });
});
