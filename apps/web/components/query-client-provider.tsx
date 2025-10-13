'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider as Provider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export function QueryClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 30,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <Provider client={client}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
    </Provider>
  );
}
