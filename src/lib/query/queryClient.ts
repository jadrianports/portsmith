import { QueryClient } from '@tanstack/react-query';

/**
 * Application-wide TanStack Query client.
 *
 * Global defaults are the handoff-spec values (docs/05-rendering.md):
 *   queries   -> retry: 2, staleTime: 30s, refetchOnWindowFocus: false
 *   mutations -> retry: 1
 *
 * TanStack Query owns ALL server data (portfolio, sections, items). UI-only,
 * ephemeral state (editor open/closed, dirty flag) lives in the Zustand store
 * (`src/lib/stores/uiStore.ts`) — never mirror server data into Zustand
 * (repo-root CLAUDE.md "TanStack Query v5 + Zustand — non-overlapping responsibilities").
 *
 * A fresh client is created per request/mount via `makeQueryClient()` so server
 * renders never share cache across users; the browser reuses a single instance
 * (see `src/app/providers.tsx`).
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 1,
      },
    },
  });
}
