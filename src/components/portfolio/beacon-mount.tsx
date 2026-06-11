'use client';
/**
 * `<BeaconMount/>` — the page-view beacon's bundle-budget wrapper (D-20/D-25 /
 * ANLY-01). Mounted ONCE in the sole `(portfolio)/layout.tsx`, it covers all four
 * public routes (`/[username]`, `/[username]/blog`, `/[username]/blog/[slug]`,
 * `/[username]/services`) for every template — current and future — with zero
 * per-page wiring (D-02/D-03). The beacon is PLATFORM CHROME, never `templates/*`.
 *
 * WHY THE { ssr: false } SPLIT (load-bearing — mirrors `command-palette-lazy.tsx`):
 * A `'use client'` beacon imported EAGERLY into the layout lands its JS in the
 * SHARED client entry (`rootMainFiles`), which `check:bundle` sums against the
 * 200 kB root + 195 kB sub-page First Load JS budgets for ALL four routes. This
 * wrapper `next/dynamic(..., { ssr: false })`-splits the real beacon logic into its
 * OWN browser-loaded chunk that is NOT part of `rootMainFiles`, so the beacon's
 * bytes never count against any route's budget (Pitfall 1). The page server-render
 * branch stays cookie/header-less, so `/[username]` stays ● SSG/ISR (D-20).
 *
 * HARD RULE (Pitfall 3): this wrapper imports `next/dynamic` ONLY — never
 * `@/lib/validations` (Zod) or `@/components/templates/registry` (both evaluate
 * `z.enum(...)` at module scope → ~63 kB Zod onto the public bundle). The beacon
 * sends a PLAIN JSON object; the SERVER (`/api/page-view`) is the only Zod gate.
 *
 * `{ ssr: false }` is ONLY legal inside a Client Component (this file) — never on a
 * Server-Component layout/template entry. This is the sanctioned place for it.
 */
import dynamic from 'next/dynamic';

// Split into its own browser chunk — NOT in the route's First Load JS (D-20/D-25).
const Beacon = dynamic(() => import('./beacon').then((m) => m.Beacon), { ssr: false });

export function BeaconMount() {
  return <Beacon />;
}
