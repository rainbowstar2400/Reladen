'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider as Provider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? dynamic<any>(() =>
        import('@tanstack/react-query-devtools').then((m) => m.ReactQueryDevtools),
      )
    : () => null;

export function QueryClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30,
            refetchOnWindowFocus: false,
            retry: 3,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
          },
        },
      })
  );

  return (
    <Provider client={client}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} position="bottom" />
    </Provider>
  );
}
