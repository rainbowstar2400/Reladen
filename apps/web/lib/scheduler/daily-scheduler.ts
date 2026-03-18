// apps/web/lib/scheduler/daily-scheduler.ts
// 日次バッチスケジューラ: 好感度減少・印象回帰・awkward回復を1時間ごとにチェック、
// 最終実行から24時間以上経過していれば実行する。

const LOCK_KEY = 'reladen:daily-decay:lock';
const LOCK_TTL_MS = 5 * 60 * 1000; // 5分
const LAST_RUN_KEY = 'reladen:daily-decay:last-run';
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24時間

type SchedulerOptions = {
  enabled?: boolean;
  checkIntervalMs?: number;
};

const DEFAULT_OPTS: Required<SchedulerOptions> = {
  enabled: true,
  checkIntervalMs: 60 * 60 * 1000, // 1時間ごとにチェック
};

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

function readLastRun(): number | null {
  try {
    const v = localStorage.getItem(LAST_RUN_KEY);
    if (!v) return null;
    const ts = Number(v);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

function writeLastRun(ts: number) {
  try {
    localStorage.setItem(LAST_RUN_KEY, String(ts));
  } catch {
    // ignore
  }
}

function tryAcquireLock(): boolean {
  const ts = readLock();
  const t = Date.now();
  if (ts && t - ts < LOCK_TTL_MS) return false;
  writeLock(t);
  return true;
}

function refreshLock() {
  writeLock(Date.now());
}

function shouldRunBatch(): boolean {
  const last = readLastRun();
  if (!last) return true; // 初回は即実行
  return Date.now() - last >= RUN_INTERVAL_MS;
}

function jitter(base: number) {
  const r = 1 + (Math.random() * 0.2 - 0.1); // ±10%
  return Math.max(30_000, Math.floor(base * r));
}

export function startDailyScheduler(opts?: SchedulerOptions) {
  if (typeof window === 'undefined') return { stop: () => {} };

  const O = { ...DEFAULT_OPTS, ...(opts ?? {}) };
  if (!O.enabled) return { stop: () => {} };

  let timer: number | null = null;
  let stopped = false;

  const tick = async () => {
    try {
      if (!tryAcquireLock()) return;
      refreshLock();

      if (!shouldRunBatch()) return;

      const res = await fetch('/api/batch/daily-decay', {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        writeLastRun(Date.now());
        const data = await res.json();
        console.log('[daily-scheduler] batch complete', data);
      } else {
        console.warn('[daily-scheduler] batch returned', res.status);
      }

      refreshLock();
    } catch (e) {
      console.warn('[daily-scheduler] failed', e);
      clearLock();
    } finally {
      scheduleNext();
    }
  };

  const scheduleNext = () => {
    if (stopped) return;
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    const ms = jitter(O.checkIntervalMs);
    timer = window.setTimeout(() => {
      timer = null;
      void tick();
    }, ms);
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
