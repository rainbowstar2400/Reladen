// apps/web/lib/utils/with-retry.ts
'use server';

import 'server-only';

export type RetryOpts = {
  retries?: number;        // 試行回数（合計）
  baseDelayMs?: number;    // 初期待機
  maxDelayMs?: number;     // 上限
  shouldRetry?: (err: unknown) => boolean; // リトライ条件
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** エクスポネンシャルバックオフ＋ジッタ */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const {
    retries = 2,           // 合計3回: 1回目+リトライ2回
    baseDelayMs = 250,
    maxDelayMs = 1500,
    shouldRetry = () => true,
  } = opts;

  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!shouldRetry(err) || attempt === retries) break;

      // 2^attempt * baseDelay + ジッタ(0〜100ms)
      const backoff = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * 100);
      await sleep(backoff + jitter);
      attempt += 1;
    }
  }
  throw lastErr;
}
