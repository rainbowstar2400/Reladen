import '@/app/globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { QueryClientProvider } from '@/components/query-client-provider';
import { SyncProvider } from '@/lib/sync/use-sync';
import { fontSans } from '@/styles/fonts';
import clsx from 'clsx';
import * as Sentry from '@sentry/nextjs'

export const metadata: Metadata = {
  title: 'Reladen Sync Dashboard',
  description: 'Residents relationship tracker with offline-first sync.',
  manifest: '/manifest.json',
};

export function generateMetadata(): Metadata {
  return {
    // 既存のメタデータをここに足してもOK
    other: {
      ...Sentry.getTraceData(),
    },
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={clsx('min-h-screen bg-background font-sans antialiased', fontSans.variable)}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryClientProvider>
            <SyncProvider>{children}</SyncProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
