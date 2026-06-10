/**
 * D-05 (dedup) / D-06 (self-view) — RED scaffold (Wave 0, Plan 15-01). GREENED BY
 * Plan 15-03 (the `Beacon` client island + the jsdom test env).
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
 * ── WHY SKIPPED (suite stays GREEN this plan) ─────────────────────────────────
 * (1) The `Beacon` component (`@/components/portfolio/beacon`) does NOT exist until
 *     Plan 15-03. (2) These specs need a DOM (`document`, `navigator.sendBeacon`,
 *     `localStorage`, `sessionStorage`), but the vitest `unit` project is the `node`
 *     env and jsdom is NOT installed in this repo (the [13-06] render-free precedent).
 *     Authoring this under `describe.skip(...)` keeps the suite GREEN (a RED suite
 *     would block the next plan's gates) AND avoids requiring jsdom now.
 *
 *     Plan 15-03, when it ships the component, will:
 *       (a) add jsdom + @testing-library/react, then a jsdom-environment docblock
 *           pragma (the "vitest-environment jsdom" directive) at the TOP of this file;
 *       (b) wire `renderBeacon` to render the real `<Beacon/>` (keyed on a mocked
 *           `usePathname`) via @testing-library/react;
 *       (c) FLIP `describe.skip` → `describe`.
 *     The assertion bodies below are written against that jsdom env so the flip is
 *     mechanical. They reference `document`/`navigator`/storage globals (present only
 *     under jsdom) — hence they MUST stay skipped until that env is added.
 *
 * NOTE: this scaffold deliberately does NOT carry the env-pragma directive yet — with
 * the directive present (and jsdom not installed), vitest would fail to start the
 * worker for this file even though every spec is skipped. 15-03 adds it with jsdom.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 15-03 replaces this stub with a real render of `<Beacon/>` under jsdom, keyed on a
// mocked `usePathname()` returning `path`. Typed here so the skipped block compiles.
type RenderBeacon = (path: string) => void;
const renderBeacon: RenderBeacon = (_path) => {
  /* wired by 15-03: render the real Beacon island under jsdom */
};

describe.skip('D-05/D-06 — Beacon dedup + self-view + marker-absent (GREENED BY 15-03)', () => {
  let sendBeacon: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    localStorage.clear();
    sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true });
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
