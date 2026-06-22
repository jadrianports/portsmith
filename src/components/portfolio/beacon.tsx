/**
 * The browser-only page-view beacon logic (ANLY-01 / ANLY-02; 15-RESEARCH Pattern 3).
 *
 * `recordView(pathname)` is lazily `import()`ed by `beacon-mount.tsx` ONLY inside a
 * browser effect, so this whole module lives in its OWN async chunk and never touches
 * the public route's shared First Load JS (`rootMainFiles`) — the D-20/D-25 bundle
 * invariant (`/[username]` + sub-routes stay ● SSG/ISR, no route over budget).
 *
 * BUNDLE-SPLIT GUARD (Pitfall 3 — load-bearing): this module imports NOTHING. No
 * React, no `next/*`, no `@/lib/validations` (Zod), no `@/components/templates/registry`.
 * It is a single framework-free browser function. The beacon sends a PLAIN JSON object;
 * the SERVER (`/api/page-view`) re-parses with `pageViewSchema` — the client parse is
 * unnecessary for a fire-and-forget beacon.
 *
 * `recordView` runs ONCE per (path) per session on route-enter (the mount calls it
 * keyed on `usePathname()`; Next client navigation re-invokes it per in-app path):
 *   1. Self-view exclusion (D-06): the dashboard wrote the owner's username(s) to
 *      `localStorage['portsmith-own-usernames']`; if the first path segment is in
 *      that list, return (the owner viewing their own portfolio / draft preview).
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

/** One dedup flag per (path) per session (D-05). */
const SESSION_PREFIX = 'pv:';
/** The owner self-view exclusion list the dashboard writes (D-06). */
const OWN_USERNAMES_KEY = 'portsmith-own-usernames';
/** The static marker the public page emits, read for the portfolio_id (Pattern 1A). */
const MARKER_SELECTOR = '[data-portfolio-id]';
const PAGE_VIEW_ENDPOINT = '/api/page-view';
/** The outbound-click ingestion endpoint (ANLY-05 / D-09) — the /api/page-view sibling. */
const EVENT_ENDPOINT = '/api/event';
/** Guard so the delegated click listener is installed exactly once per document. */
let clickListenerInstalled = false;

/**
 * Fire a single page-view beacon for `pathname` (idempotent per path per session).
 * Safe to call repeatedly — the session guard + marker check make extra calls no-ops.
 */
export function recordView(pathname: string): void {
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
}

/**
 * The outbound-anchor `destination_host` for an `<a href>` (ANLY-05 / D-10). For a
 * `mailto:`/`tel:` link the SCHEME is sent verbatim (`mailto:`/`tel:`) so the server
 * can bucket it as `contact`; for an http(s) link the HOST is sent. Returns `null`
 * for a same-host (internal) link or an unparseable href — the caller skips those.
 */
function outboundDestinationHost(href: string): string | null {
  // Scheme links (contact channels) — send the scheme, not a host (D-10).
  if (href.startsWith('mailto:')) return 'mailto:';
  if (href.startsWith('tel:')) return 'tel:';
  try {
    const url = new URL(href, window.location.href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null; // not an outbound web link
    if (url.host === window.location.host) return null; // internal navigation — not an outbound click
    return url.host;
  } catch {
    return null; // malformed href — skip
  }
}

/**
 * Install the delegated outbound-anchor click listener ONCE (ANLY-05 / D-07/D-08).
 * Idempotent — repeat calls (one per route-enter via the lazy import) are no-ops.
 *
 * A single capture-phase `document` click listener walks up from the event target to
 * the nearest `<a href>`, computes the outbound destination host (different host, or
 * a `mailto:`/`tel:` scheme), reads the `portfolio_id` from the SAME
 * `[data-portfolio-id]` marker `recordView` uses, and fires a plain-JSON beacon to
 * `/api/event`. The server derives the category (D-10) and is the only Zod gate.
 *
 * NO per-session dedup: a repeated outbound click is real engagement signal (unlike a
 * page view). Fire-and-forget — a missed click is acceptable.
 */
export function installOutboundClickListener(): void {
  if (clickListenerInstalled) return;
  clickListenerInstalled = true;

  document.addEventListener(
    'click',
    (event) => {
      // Walk up to the nearest anchor with an href (the click may land on a child span/icon).
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      const destinationHost = outboundDestinationHost(href);
      if (!destinationHost) return; // internal / non-web link — not an outbound click

      // The portfolio_id from the page-emitted marker (Pattern 1A). Absent → no-op.
      const pid = document.querySelector(MARKER_SELECTOR)?.getAttribute('data-portfolio-id');
      if (!pid) return;

      const payload = {
        portfolio_id: pid,
        destination_host: destinationHost,
        path: window.location.pathname,
      };

      // Fire-and-forget — sendBeacon primary (a JSON Blob carries the Content-Type),
      // fetch(keepalive) fallback. Copied from recordView's transport (endpoint only changed).
      const body = JSON.stringify(payload);
      const blob = new Blob([body], { type: 'application/json' });
      const sent =
        typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(EVENT_ENDPOINT, blob);
      if (!sent) {
        void fetch(EVENT_ENDPOINT, {
          method: 'POST',
          keepalive: true,
          headers: { 'content-type': 'application/json' },
          body,
        }).catch(() => {
          /* swallow — a missed click is acceptable for a beacon */
        });
      }
    },
    { capture: true },
  );
}
