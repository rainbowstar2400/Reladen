import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listLocal: vi.fn(),
  selectConversationCandidates: vi.fn(),
  loadWorldWeather: vi.fn(),
  saveWorldWeather: vi.fn(),
  ensureQuietHours: vi.fn(),
  isWithinQuietHours: vi.fn(),
  pickNextWeatherKind: vi.fn(),
}));

vi.mock('@/lib/db-local', () => ({
  listLocal: mocks.listLocal,
}));

vi.mock('@/lib/conversation/candidates', () => ({
  selectConversationCandidates: mocks.selectConversationCandidates,
}));

vi.mock('@/lib/data/world-weather', () => ({
  DEFAULT_WORLD_ID: '00000000-0000-4000-8000-000000000000',
  loadWorldWeather: mocks.loadWorldWeather,
  saveWorldWeather: mocks.saveWorldWeather,
  ensureQuietHours: mocks.ensureQuietHours,
}));

vi.mock('@repo/shared/logic/weather', () => ({
  isWithinQuietHours: mocks.isWithinQuietHours,
  pickNextWeatherKind: mocks.pickNextWeatherKind,
}));

import { startWeatherScheduler } from '@/lib/scheduler/weather-scheduler';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
  };
}

function installBrowserLikeGlobals() {
  const localStorage = createMemoryStorage();
  (globalThis as any).window = {
    setTimeout,
    clearTimeout,
    localStorage,
  };
  (globalThis as any).localStorage = localStorage;
}

describe('weather scheduler', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let worldState: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    installBrowserLikeGlobals();

    worldState = {
      id: '00000000-0000-4000-8000-000000000000',
      owner_id: null,
      deleted: false,
      updated_at: '2026-01-01T00:00:00.000Z',
      current: { kind: 'sunny', lastChangedAt: '2026-01-01T00:00:00.000Z' },
      quietHours: { startHour: 0, endHour: 0 },
      currentComment: null,
    };

    mocks.listLocal.mockResolvedValue([
      { id: 'resident_A', name: 'A', deleted: false },
      { id: 'resident_B', name: 'B', deleted: false },
    ]);
    mocks.selectConversationCandidates.mockImplementation(
      (_now: Date, residents: Array<{ id: string }>) => residents,
    );
    mocks.loadWorldWeather.mockImplementation(async () => ({
      ...worldState,
      current: { ...worldState.current },
      quietHours: { ...worldState.quietHours },
      currentComment: worldState.currentComment ? { ...worldState.currentComment } : null,
    }));
    mocks.saveWorldWeather.mockImplementation(async (next: any) => {
      worldState = { ...next };
      return next;
    });
    mocks.ensureQuietHours.mockImplementation((state: any) => state);
    mocks.isWithinQuietHours.mockReturnValue(false);
    mocks.pickNextWeatherKind.mockReturnValue('rain');

    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: '今日は少し曇りそう。' }),
    });
    (globalThis as any).fetch = fetchMock;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
    delete (globalThis as any).fetch;
  });

  it('早期return経路でもタイマーが増殖しない', async () => {
    mocks.isWithinQuietHours.mockReturnValue(true);
    const scheduler = startWeatherScheduler({ baseIntervalMs: 60_000 });

    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(54_000);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(54_000);
    expect(vi.getTimerCount()).toBe(1);

    scheduler.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('複数起動でも最短間隔内のコメント生成は1回だけ', async () => {
    const s1 = startWeatherScheduler({ baseIntervalMs: 3_600_000 });

    // 2つ目のタブ起動を模擬（同じlocalStorageを共有）
    await vi.advanceTimersByTimeAsync(600_000);
    const s2 = startWeatherScheduler({ baseIntervalMs: 3_600_000 });

    // 1つ目の初回実行（3,240,000ms）
    await vi.advanceTimersByTimeAsync(2_640_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 2つ目の初回実行（3,840,000ms）は最短間隔未満のためスキップ
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    s1.stop();
    s2.stop();
  });
});
