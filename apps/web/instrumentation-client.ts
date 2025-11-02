// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

'use client';
import * as Sentry from '@sentry/nextjs';

declare global {
  // 二重初期化防止用のフラグ
  // eslint-disable-next-line no-var
  var __SENTRY_INITED__: boolean | undefined;
}

if (!globalThis.__SENTRY_INITED__) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
    tracesSampleRate: 1,
    // Enable logs to be sent to Sentry
    enableLogs: true,

    // Enable sending user PII (Personally Identifiable Information)
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
    sendDefaultPii: true,
  });
  globalThis.__SENTRY_INITED__ = true;
}

export {};