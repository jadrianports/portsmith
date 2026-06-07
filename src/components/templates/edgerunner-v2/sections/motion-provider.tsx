'use client';
/**
 * MotionProvider — the LazyMotion context for all of edgerunner-v2's `m.*` islands
 * (bundle-budget; D-25 / TMPL-04 ≤200 kB First Load JS).
 *
 * WHY: every edgerunner-v2 section is a `'use client'` motion island. Importing the FULL
 * `motion` component eagerly bundled motion's whole feature set (~42 kB gz) into the
 * public `/[username]` First Load JS, pushing the route over the 200 kB budget. Switching
 * the islands to the slim `m` component + loading the feature bundle ASYNCHRONOUSLY here
 * moves those bytes into a deferred chunk that loads after hydration.
 *
 * This is a thin client boundary that renders its (server-rendered) children inside a
 * `<LazyMotion>`. React context propagates to the `m.*` client islands nested in those
 * children, so each section animates once `loadFeatures` resolves. `strict` is intentionally
 * NOT set: a stray full-`motion` component should degrade (render rest state) rather than
 * throw on the public page.
 *
 * Determinism: under `prefers-reduced-motion: reduce` (the parity capture config) the
 * entrance animations are suppressed regardless, so the deferred-features render matches the
 * committed golden baseline.
 */
import { LazyMotion } from 'motion/react';
import type { ReactNode } from 'react';

// Async feature load — returns the domAnimation bundle as its OWN chunk (out of First Load JS).
const loadFeatures = () => import('./motion-features').then((res) => res.default);

export function MotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
