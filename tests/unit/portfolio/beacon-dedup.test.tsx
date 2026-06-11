/**
 * @vitest-environment jsdom
 *
 * D-05 (dedup) / D-06 (self-view) — GREENED BY Plan 15-03 (the `Beacon` client
 * island + the jsdom test env, both shipped in 15-03). This file's specs run under
 * the jsdom environment declared in the pragma above (jsdom + @testing-library/react
 * were added in 15-03, per the 15-01 deferral). `renderBeacon` renders the REAL
 * `<Beacon/>` keyed on a mocked `usePathname()`.
 *
 * Encodes the browser-only beacon contract (15-RESEARCH.md § Architecture Pattern 3):
 *   - fires `navigator.sendBeacon('/api/page-view', …)` ONCE on first render at a path
 *     that has a `[data-portfolio-id]` marker in the DOM;
 *   - does NOT re-fire on a second render at the SAME pathname in the same session
 *     (the `sessionStorage['pv:'+path]` guard — D-05);
 *   - DOES fire again for a DIFFERENT path in the same session;
 *   - does NOT fire when `localStorage['portsmith-own-usernames']` contains the first
 *     path segment (the owner viewing their own portfolio — D-06);
 *   - does NOT fire when there is NO `[data-portfolio-id]` marker (the `__fixture`
 *     route / draft-preview no-op — Pitfall 5).
 *
 * ── HOW THE FLIP WORKS (15-03) ────────────────────────────────────────────────
 * (a) the `@vitest-environment jsdom` pragma at the TOP gives this file `document`,
 *     `navigator`, `localStorage`, `sessionStorage` (jsdom was added in 15-03);
 * (b) `next/navigation` is mocked so `usePathname()` returns the `path` the current
 *     `renderBeacon(path)` call set — letting one test render the same path twice
 *     (dedup) or two different paths (re-fire);
 * (c) `renderBeacon` renders the REAL `<Beacon/>` via @testing-library/react inside
 *     `act(...)` so the beacon's `useEffect` flushes synchronously before assertions.
 */
import { cleanup, render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Beacon } from '@/components/portfolio/beacon';

// `usePathname()` is the only `next/navigation` hook the beacon uses. A mutable
// holder lets each `renderBeacon(path)` call drive what the hook returns.
let currentPath = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => currentPath,
}));

// Render the real <Beacon/> at `path` under jsdom. Each call mounts a fresh root
// (after cleaning up the prior one) so the path-keyed `useEffect` runs once per call;
// `act(...)` flushes the effect synchronously before the test asserts.
type RenderBeacon = (path: string) => void;
const renderBeacon: RenderBeacon = (path) => {
  currentPath = path;
  cleanup(); // unmount any prior render so this mount's effect fires fresh
  act(() => {
    render(<Beacon />);
  });
};

describe('D-05/D-06 — Beacon dedup + self-view + marker-absent (GREENED BY 15-03)', () => {
  let sendBeacon: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    localStorage.clear();
    sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true });
  });

  // Unmount any React root the test mounted so it cannot bleed into the next test.
  afterEach(() => {
    cleanup();
  });

  // A non-visual marker the public pages emit (Pattern 1A); the beacon reads it.
  function mountMarker(portfolioId: string): void {
    const el = document.createElement('div');
    el.setAttribute('data-portfolio-id', portfolioId);
    el.hidden = true;
    document.body.appendChild(el);
  }

  it('fires sendBeacon ONCE on first render at a marked path', () => {
    mountMarker('00000000-0000-0000-0000-0000000000aa');
    renderBeacon('/someoneelse');
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0]![0]).toBe('/api/page-view');
  });

  it('does NOT re-fire on a second render at the SAME path in the session (D-05 dedup)', () => {
    mountMarker('00000000-0000-0000-0000-0000000000aa');
    renderBeacon('/someoneelse');
    renderBeacon('/someoneelse'); // same pathname, same session → suppressed
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });

  it('DOES fire again for a DIFFERENT path in the same session', () => {
    mountMarker('00000000-0000-0000-0000-0000000000aa');
    renderBeacon('/someoneelse');
    renderBeacon('/someoneelse/blog/post-1'); // new path → a fresh beacon
    expect(sendBeacon).toHaveBeenCalledTimes(2);
  });

  it('does NOT fire when the owner views their own portfolio (D-06 self-view)', () => {
    mountMarker('00000000-0000-0000-0000-0000000000aa');
    localStorage.setItem('portsmith-own-usernames', JSON.stringify(['jadrianports']));
    renderBeacon('/jadrianports'); // first path segment is in the owner list
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('does NOT fire when there is NO [data-portfolio-id] marker (Pitfall 5 — __fixture no-op)', () => {
    // No mountMarker() call → marker absent.
    renderBeacon('/__fixture/minimal');
    expect(sendBeacon).not.toHaveBeenCalled();
  });
});
