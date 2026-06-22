'use client';
/**
 * `<BeaconMount/>` — the page-view beacon's layout-level trigger (D-20/D-25 /
 * ANLY-01). Mounted ONCE in the sole `(portfolio)/layout.tsx`, it covers all four
 * public routes (`/[username]`, `/[username]/blog`, `/[username]/blog/[slug]`,
 * `/[username]/services`) for every template — current and future — with zero
 * per-page wiring (D-02/D-03). The beacon is PLATFORM CHROME, never `templates/*`.
 *
 * WHY THIS SHAPE (load-bearing bundle discipline — Pitfall 1):
 * Any `'use client'` component imported by the lean `(portfolio)` layout lands in
 * the SHARED client entry (`rootMainFiles`), which `check:bundle` sums against the
 * 200 kB root + 195 kB sub-page First Load JS budgets for ALL four routes. To keep
 * that shared cost to the bare MINIMUM this trigger:
 *   - renders NOTHING and holds NO JSX child (no `next/dynamic` render machinery in
 *     the shared entry — a `next/dynamic({ssr:false})` wrapper measurably inflated
 *     every route's `rootMainFiles` and pushed `/services` over its 195 kB budget);
 *   - lazily `import()`s the REAL beacon logic (`./beacon`) ONLY in a browser effect,
 *     so the beacon's code loads in its OWN async chunk that is NOT part of
 *     `rootMainFiles` (D-20/D-25). The only shared cost is this tiny effect + the
 *     `usePathname` hook (already in the shared client runtime).
 *
 * HARD RULE (Pitfall 3): this module imports `next/navigation` + `react` ONLY —
 * never `@/lib/validations` (Zod) or `@/components/templates/registry` (both evaluate
 * `z.enum(...)` at module scope → ~63 kB Zod onto the public bundle). The lazily-
 * imported `./beacon` is likewise Zod/registry-free; it sends a PLAIN JSON object and
 * the SERVER (`/api/page-view`) is the only Zod gate.
 *
 * Keyed on `usePathname()`: Next client-side navigation re-runs the effect on each
 * in-app path change → one beacon attempt per path (the beacon's own per-session
 * guard suppresses refresh/back-forward repeats — D-05).
 */
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function BeaconMount() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    // Lazy browser-only import — the beacon logic loads in its OWN async chunk,
    // OUTSIDE the layout's shared First Load JS (D-20/D-25). The same lazy chunk also
    // installs the delegated outbound-click listener (idempotent — ANLY-05/D-08), so
    // the click capture rides off rootMainFiles too.
    void import('./beacon').then((m) => {
      m.installOutboundClickListener();
      m.recordView(pathname);
    });
  }, [pathname]);

  return null; // renders nothing
}
