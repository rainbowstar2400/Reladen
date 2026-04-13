'use client'

import type { ReactNode } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryClientProvider } from '@/components/query-client-provider'
import ConversationSchedulerProvider from '@/components/providers/ConversationSchedulerProvider'
import { FormDirtyProvider } from '@/components/providers/FormDirtyProvider';
import WeatherSchedulerProvider from '@/components/providers/WeatherSchedulerProvider';
import DailyDecaySchedulerProvider from '@/components/providers/DailyDecaySchedulerProvider';
import { SyncProvider } from '@/lib/sync/use-sync'
// Sync や Toaster を使っているなら適宜
// import { SonnerToaster } from '@/components/sonner-toaster'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider>
        <SyncProvider>
          <ConversationSchedulerProvider>
            <WeatherSchedulerProvider>
              <DailyDecaySchedulerProvider>
                <FormDirtyProvider>
                  {children}
                </FormDirtyProvider>
              </DailyDecaySchedulerProvider>
            </WeatherSchedulerProvider>
          </ConversationSchedulerProvider>
        </SyncProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
