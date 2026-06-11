'use client';
/**
 * The browser-only page-view beacon (ANLY-01 / ANLY-02; 15-RESEARCH Pattern 3).
 * Loaded via `next/dynamic({ ssr: false })` from `beacon-mount.tsx`, so its code
 * lives in its OWN client chunk and never touches the public route's First Load JS
 * (D-20/D-25). Renders NOTHING (`return null`).
 *
 * BUNDLE-SPLIT GUARD (Pitfall 3 — load-bearing): this module imports ONLY
 * `next/navigation` + `react`. It does NOT import `@/lib/validations` (Zod) or
 * `@/components/templates/registry`. The beacon sends a PLAIN JSON object; the
 * SERVER (`/api/page-view`) re-parses with `pageViewSchema` — the client parse is
 * unnecessary for a fire-and-forget beacon.
 *
 * Fires ONCE per (path) per session on route-enter via a `useEffect` keyed on
 * `usePathname()` (Next client navigation re-runs the effect on each in-app path
 * change → a fresh beacon per path; the session guard suppresses refresh/back-fwd):
 *   1. Self-view exclusion (D-06): the dashboard wrote the owner's username(s) to
 *      `localStorage['portsmith-own-usernames']`; if the first path segment is in
 *      that list, SKIP (the owner viewing their own portfolio / draft preview).
 *   2. Per-(path) per-session dedup (D-05): a `sessionStorage['pv:'+path]` flag.
 *   3. Marker read (Pattern 1A): the `portfolio_id` comes from the static
 *      `[data-portfolio-id]` attribute the public page emits (via the renderer). No
 *      marker (e.g. the `__fixture` route) → no-op (Pitfall 5).
 *   4. Source attribution (D-10): referrer HOST only + `utm_source`/`utm_medium`
 *      from the URL query (bucketed at READ time server-side, UTM-wins).
 *   5. Transport: `navigator.sendBeacon` (a JSON Blob) primary; a `fetch` with
 *      `keepalive:true` fallback when sendBeacon is unavailable or returns false.
 *
 * NO raw IP is ever sent (ANLY-02) — the server derives the rate-limit subject from
 * the request IP and never persists it.
 */
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** One dedup flag per (path) per session (D-05). */
const SESSION_PREFIX = 'pv:';
/** The owner self-view exclusion list the dashboard writes (D-06). */
const OWN_USERNAMES_KEY = 'portsmith-own-usernames';
/** The static marker the public page emits, read for the portfolio_id (Pattern 1A). */
const MARKER_SELECTOR = '[data-portfolio-id]';
const PAGE_VIEW_ENDPOINT = '/api/page-view';

export function Beacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    // 1) Self-view exclusion (D-06) — the dashboard wrote the owner's username(s).
    //    Fail TOWARD firing on a parse error (an honest miss is better than a lost view).
    try {
      const owners: unknown = JSON.parse(localStorage.getItem(OWN_USERNAMES_KEY) ?? '[]');
      const seg = pathname.split('/').filter(Boolean)[0]; // '/[username]/...' → username
      if (Array.isArray(owners) && seg && owners.includes(seg)) return; // skip own portfolio
    } catch {
      /* ignore parse/storage error — fall through toward firing */
    }

    // 2) Per-(path) per-session dedup (D-05). If storage is blocked, proceed (treat as a view).
    const key = SESSION_PREFIX + pathname;
    try {
      if (sessionStorage.getItem(key)) return; // already counted this session
      sessionStorage.setItem(key, '1');
    } catch {
      /* sessionStorage blocked — proceed (treat as a view) */
    }

    // 3) Resolve portfolio_id from the page-emitted marker (Pattern 1A). Absent
    //    (e.g. the __fixture route) → no-op (Pitfall 5).
    const pid = document.querySelector(MARKER_SELECTOR)?.getAttribute('data-portfolio-id');
    if (!pid) return;

    // 4) Source attribution (D-10) — referrer HOST only + UTM (bucketed at READ time).
    let referrerHost: string | null = null;
    try {
      referrerHost = document.referrer ? new URL(document.referrer).host : null;
    } catch {
      /* malformed referrer — leave null */
    }
    const q = new URLSearchParams(window.location.search);

    const payload = {
      portfolio_id: pid,
      path: pathname,
      referrer_host: referrerHost,
      utm_source: q.get('utm_source'),
      utm_medium: q.get('utm_medium'),
    };

    // 5) Fire-and-forget. sendBeacon primary (a JSON Blob — sendBeacon cannot set
    //    headers, so the Blob's `type` carries the Content-Type); fetch(keepalive) fallback.
    const body = JSON.stringify(payload);
    const blob = new Blob([body], { type: 'application/json' });
    const sent =
      typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(PAGE_VIEW_ENDPOINT, blob);
    if (!sent) {
      void fetch(PAGE_VIEW_ENDPOINT, {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body,
      }).catch(() => {
        /* swallow — a missed view is acceptable for a beacon */
      });
    }
  }, [pathname]);

  return null; // renders nothing
}
