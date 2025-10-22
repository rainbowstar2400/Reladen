import '@/app/globals.css'
import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryClientProvider } from '@/components/query-client-provider'
import { SyncProvider } from '@/lib/sync/use-sync'
import { fontSans } from '@/styles/fonts'
import clsx from 'clsx'
import * as Sentry from '@sentry/nextjs'
import { SonnerToaster } from '@/components/sonner-toaster'
import { MainNav } from '@/components/main-nav'

const baseMetadata: Metadata = {
  title: 'Reladen Sync Dashboard',
  description: 'Residents relationship tracker with offline-first sync.',
  manifest: '/manifest.json',
}

// ❗ metadata は export しない（generateMetadata に一本化）
export function generateMetadata(): Metadata {
  // Sentryのトレースデータを取得
  const trace = Sentry.getTraceData()

  // ✅ Metadata.other は「string/number/(string|number)[]」のみ許可。
  //   必要な2キーだけを安全に詰める（undefinedは入れない）
  const other: Record<string, string | number | (string | number)[]> = {}
  if (typeof trace['sentry-trace'] === 'string') {
    other['sentry-trace'] = trace['sentry-trace']
  }
  if (typeof trace['baggage'] === 'string') {
    other['baggage'] = trace['baggage']
  }

  return {
    ...baseMetadata,
    other, // ← 型に適合
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={clsx('min-h-screen bg-background font-sans antialiased', fontSans.variable)}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryClientProvider>
            <SyncProvider>
              <div className="flex min-h-screen flex-col bg-background md:flex-row">
                <MainNav />
                <div className="flex-1">
                  <main className="min-h-screen px-4 py-6 md:px-8 md:py-8">{children}</main>
                </div>
              </div>
            </SyncProvider>
            <SonnerToaster />
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
