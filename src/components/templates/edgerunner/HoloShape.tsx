/**
 * edgerunner/HoloShape.tsx — the THIN client mount: the rich/viz lane's
 * `{ ssr: false }` boundary (PIPE-09 / D-03 / D-11; RESEARCH §2; PATTERNS
 * "edgerunner/HoloShape.tsx — NEW PATTERN").
 *
 * This is the contract the Hero section (plan 04) consumes — it renders the
 * synthwave WebGL centerpiece. It imports ONLY `next/dynamic` + React. The heavy
 * `three`/`@react-three/*` import lives one level down in `./Scene` (the lazy
 * chunk the async-island cap measures) and is reachable ONLY through the
 * `dynamic(() => import('./Scene'), { ssr: false })` boundary below.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ LOAD-BEARING (RESEARCH Pitfall 2 / D-05 / T-13-03-LEAK):                      │
 * │ This file MUST NOT import `three`, `@react-three/fiber`, or                   │
 * │ `@react-three/drei`. An eager import here would pull the ~235 kB scene chunk  │
 * │ into the public First Load JS (it would no longer be code-split behind the    │
 * │ `{ ssr: false }` boundary), breaking the ≤200 kB standard-lane budget. The    │
 * │ plan-02 RSC-root grep + this file's grep verify the isolation, and            │
 * │ `check:bundle` confirms First Load JS does not jump.                          │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * `{ ssr: false }` is ALLOWED here because this is a Client Component (D-11). It is
 * BUILD-FORBIDDEN in the RSC template root (`edgerunner/index.tsx`) — Next 16
 * hard-errors "`ssr: false` is not allowed with `next/dynamic` in Server
 * Components." The root imports only this thin mount, never `./Scene` directly.
 */
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// The lazy WebGL chunk. `{ ssr: false }` keeps it out of the server render AND out
// of First Load JS (it loads after paint, in the browser only). `loading: () => null`
// is correct because the scoped `.tmpl-edgerunner` CSS synthwave backdrop is already
// painted underneath — the scene is additive progressive enhancement (D-04), never a
// loading-spinner gap.
const Scene = dynamic(() => import('./Scene').then((m) => m.Scene), {
  ssr: false,
  loading: () => null,
});

/**
 * The HoloShape mount. Mount-gates (returns `null` until the client has mounted,
 * the export's own pattern at `HoloShape.tsx:43-45`) so there is no hydration
 * mismatch, then renders the lazy `<Scene />` inside the caller-supplied wrapper.
 * If the scene chunk never loads (no WebGL, slow network), the CSS backdrop shows
 * through unchanged — the page is never broken by the scene's absence (D-04).
 */
export function HoloShape({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <div className={className}>
      <Scene />
    </div>
  );
}
