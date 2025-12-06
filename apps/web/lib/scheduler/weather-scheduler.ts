// apps/web/lib/scheduler/weather-scheduler.ts
// 1時間ごとにワールドの天気を更新するクライアント側スケジューラ。

import { listLocal } from '@/lib/db-local';
import type { Resident } from '@/types';
import { selectConversationCandidates } from '@/lib/conversation/candidates';
import { DEFAULT_WORLD_ID, ensureQuietHours, loadWorldWeather, saveWorldWeather } from '@/lib/data/world-weather';
import {
  isWithinQuietHours,
  pickNextWeatherKind,
} from '@repo/shared/logic/weather';
import type { WeatherKind, WorldWeatherState } from '@repo/shared/types';

const LOCK_KEY = 'reladen:weather-scheduler:lock';
const LOCK_TTL_MS = 5 * 60 * 1000;

type SchedulerOptions = {
  enabled?: boolean;
  baseIntervalMs?: number;
  worldId?: string;
};

const DEFAULT_OPTS: Required<SchedulerOptions> = {
  enabled: true,
  baseIntervalMs: 60 * 60 * 1000, // 1時間
  worldId: DEFAULT_WORLD_ID,
};

function nowTs() {
  return Date.now();
}
function readLock(): number | null {
  try {
    const v = localStorage.getItem(LOCK_KEY);
    if (!v) return null;
    const ts = Number(v);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}
function writeLock(ts: number) {
  try {
    localStorage.setItem(LOCK_KEY, String(ts));
  } catch {
    // ignore
  }
}
function clearLock() {
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {
    // ignore
  }
}
function tryAcquireLock(): boolean {
  const ts = readLock();
  const t = nowTs();
  if (ts && t - ts < LOCK_TTL_MS) return false;
  writeLock(t);
  return true;
}
function refreshLock() {
  writeLock(nowTs());
}

function jitter(base: number) {
  const r = 1 + (Math.random() * 0.2 - 0.1); // ±10%
  return Math.max(30_000, Math.floor(base * r));
}

async function pickWeatherCommentResident(now: Date, residents: Resident[]): Promise<Resident | null> {
  const awake = selectConversationCandidates(now, residents);
  if (!awake.length) return null;
  const shuffled = [...awake].sort(() => 0.5 - Math.random());
  return shuffled[0] ?? null;
}

async function updateSleepingCommentIfNeeded(
  state: WorldWeatherState,
  residents: Resident[],
): Promise<WorldWeatherState> {
  const comment = state.currentComment;
  if (!comment || !comment.residentId) return state;
  const target = residents.find((r) => r.id === comment.residentId);
  if (!target) return { ...state, currentComment: null };

  const sit = selectConversationCandidates(new Date(), [target]);
  const isSleeping = sit.length === 0;
  if (!isSleeping || comment.status === 'sleeping') return state;

  return {
    ...state,
    currentComment: {
      ...comment,
      text: 'Zzz…',
      status: 'sleeping',
      createdAt: new Date().toISOString(),
    },
  };
}

export function startWeatherScheduler(opts?: SchedulerOptions) {
  if (typeof window === 'undefined') return { stop: () => {} };

  const O = { ...DEFAULT_OPTS, ...(opts ?? {}) };
  if (!O.enabled) return { stop: () => {} };

  let timer: number | null = null;
  let stopped = false;

  const tick = async () => {
    try {
      if (!tryAcquireLock()) {
        scheduleNext();
        return;
      }
      refreshLock();

      const now = new Date();
      const residents = ((await listLocal<Resident>('residents')) ?? []).filter((r) => !r.deleted);
      let world = await loadWorldWeather(O.worldId);
      const weather = ensureQuietHours(
        { current: world.current, quietHours: world.quietHours, currentComment: world.currentComment },
        residents,
      );
      world = { ...world, ...weather };

      const updatedWeather = await updateSleepingCommentIfNeeded(world, residents);
      if (updatedWeather !== world) {
        world = { ...world, ...updatedWeather };
        await saveWorldWeather(world);
      }

      if (isWithinQuietHours(now, world.quietHours)) {
        refreshLock();
        scheduleNext();
        return;
      }

      const currentKind = world.current.kind as WeatherKind;
      const nextKind = pickNextWeatherKind(currentKind);
      if (nextKind === currentKind) {
        refreshLock();
        scheduleNext();
        return;
      }

      const resident = await pickWeatherCommentResident(now, residents);
      let newComment = null;
      if (resident) {
        try {
          const res = await fetch('/api/weather/comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resident,
              weatherKind: nextKind,
              now: now.toISOString(),
            }),
            credentials: 'include',
          });
          if (res.ok) {
            const data = await res.json();
            const text = data?.text;
            if (typeof text === 'string' && text.trim().length > 0) {
              newComment = {
                residentId: resident.id,
                text,
                status: 'normal' as const,
                createdAt: now.toISOString(),
              };
            }
          }
        } catch (error) {
          console.warn('[weather-scheduler] comment generation failed', error);
        }
        if (!newComment) {
          refreshLock();
          scheduleNext();
          return;
        }
      }

      world.current = { kind: nextKind, lastChangedAt: now.toISOString() };
      if (newComment) world.currentComment = newComment;

      await saveWorldWeather(world);
      refreshLock();
    } catch (e) {
      console.warn('[weather-scheduler] failed', e);
      clearLock();
    } finally {
      scheduleNext();
    }
  };

  const scheduleNext = () => {
    if (stopped) return;
    const ms = jitter(O.baseIntervalMs);
    timer = window.setTimeout(tick, ms);
  };

  scheduleNext();

  const stop = () => {
    stopped = true;
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    clearLock();
  };

  return { stop };
}
