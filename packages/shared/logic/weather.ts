import type { QuietHours, Resident, WorldWeatherState, WeatherKind } from '../types';

// Weighted transition table (simple, editable)
export const WEATHER_TRANSITIONS: Record<WeatherKind, Array<{ to: WeatherKind; weight: number }>> = {
  sunny: [
    { to: 'sunny', weight: 40 },
    { to: 'cloudy', weight: 35 },
    { to: 'rain', weight: 20 },
    { to: 'storm', weight: 5 },
  ],
  cloudy: [
    { to: 'sunny', weight: 25 },
    { to: 'cloudy', weight: 35 },
    { to: 'rain', weight: 30 },
    { to: 'storm', weight: 10 },
  ],
  rain: [
    { to: 'sunny', weight: 10 },
    { to: 'cloudy', weight: 30 },
    { to: 'rain', weight: 40 },
    { to: 'storm', weight: 20 },
  ],
  storm: [
    { to: 'sunny', weight: 5 },
    { to: 'cloudy', weight: 25 },
    { to: 'rain', weight: 30 },
    { to: 'storm', weight: 40 },
  ],
};

export function pickNextWeatherKind(current: WeatherKind): WeatherKind {
  const list = WEATHER_TRANSITIONS[current] ?? WEATHER_TRANSITIONS.sunny;
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (const item of list) {
    acc += item.weight;
    if (r <= acc) return item.to;
  }
  return list[list.length - 1]?.to ?? current;
}

export function isWithinQuietHours(now: Date, quiet: QuietHours): boolean {
  const h = now.getHours();
  const { startHour, endHour } = quiet;
  if (startHour <= endHour) return h >= startHour && h < endHour;
  return h >= startHour || h < endHour;
}

function hmToHour(hm?: string | null): number | null {
  if (!hm || typeof hm !== 'string') return null;
  const [h] = hm.split(':').map((x) => Number(x));
  if (Number.isFinite(h) && h >= 0 && h <= 23) return h;
  return null;
}

/**
 * Resident から quiet hours を計算する。
 * todaySchedule 優先 / なければ baseBedtime/baseWakeTime を使用。
 * jitter は ±1h として扱う。
 */
export function calcQuietHoursForWorld(residents: Resident[], jitterHours = 1): QuietHours | null {
  const sleepHours: Array<{ bed: number; wake: number }> = [];

  for (const r of residents) {
    const profile = (r as any).sleepProfile as SleepProfile | undefined;
    if (!profile) continue;

    // 今日のスケジュールを優先
    const bedtime = profile.todaySchedule?.bedtime ?? profile.baseBedtime;
    const wakeTime = profile.todaySchedule?.wakeTime ?? profile.baseWakeTime;
    const bedHour = hmToHour(bedtime);
    const wakeHour = hmToHour(wakeTime);
    if (bedHour === null || wakeHour === null) continue;

    sleepHours.push({ bed: bedHour, wake: wakeHour });
  }

  if (sleepHours.length === 0) return null;

  const startHour = sleepHours.reduce(
    (min, cur) => Math.min(min, (cur.bed - jitterHours + 24) % 24),
    23,
  );
  const endHour = sleepHours.reduce(
    (min, cur) => Math.min(min, (cur.wake - jitterHours + 24) % 24),
    23,
  );

  return { startHour, endHour };
}

export function createInitialWeatherState(): WorldWeatherState {
  const now = new Date().toISOString();
  return {
    current: { kind: 'sunny', lastChangedAt: now },
    quietHours: { startHour: 0, endHour: 0 },
    currentComment: null,
  };
}
