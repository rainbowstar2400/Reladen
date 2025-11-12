'use client'

import type { ReactNode } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryClientProvider } from '@/components/query-client-provider'
import ConversationSchedulerProvider from '@/components/providers/ConversationSchedulerProvider'
import { FormDirtyProvider } from '@/components/providers/FormDirtyProvider';
// Sync や Toaster を使っているなら適宜
// import { SyncProvider } from '@/lib/sync/use-sync'
// import { SonnerToaster } from '@/components/sonner-toaster'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider>
        <ConversationSchedulerProvider>
          {/* <SyncProvider> */}
          {children}
          {/* </SyncProvider> */}
          {/* <SonnerToaster /> */}
        </ConversationSchedulerProvider>
      </QueryClientProvider>
      <FormDirtyProvider>
        {children}
      </FormDirtyProvider>
    </ThemeProvider>
  )
}
