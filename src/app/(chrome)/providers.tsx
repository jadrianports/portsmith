'use client';

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { makeQueryClient } from '@/lib/query/queryClient';

let browserQueryClient: QueryClient | undefined;

/**
 * Returns the QueryClient to use.
 *
 * - On the server: always make a fresh client (never share cache across requests
 *   / users — a shared server client would leak one user's data into another's
 *   render).
 * - In the browser: reuse a single module-level client so React Fast Refresh and
 *   re-renders don't blow away the cache. Guarded against the React-suspense
 *   double-render race by initializing only once.
 */
function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

/**
 * Root client-side provider tree, wired into the chrome root layout
 * (`src/app/(chrome)/layout.tsx`). Wraps the app in TanStack Query's provider and mounts
 * the React Query Devtools in development only.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // useState ensures the browser client is created once per component lifecycle
  // and survives re-renders (TanStack v5 + Next App Router recommended pattern).
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
}
