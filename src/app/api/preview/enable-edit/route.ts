/**
 * `GET /api/preview/enable-edit` — turn ON Draft Mode for the OWNER, then return a
 * bare `204 No Content` (Phase 27 — EDIT-01 / D-15). This is the EDITOR-scoped
 * sibling of `/api/preview/enable`: the chrome editor calls it via `fetch` from a
 * mount effect to acquire the `__prerender_bypass` draft cookie BEFORE pointing its
 * live-preview `<iframe>` at the owner's own slug — so the iframe's first paint is the
 * owner's UNPUBLISHED, last-saved draft rendered through the committed template.
 *
 * WHY A SEPARATE NON-REDIRECTING ROUTE (D-15 / D-09, vs reusing `enable`):
 * - NO REDIRECT: `/api/preview/enable` 30x-redirects to the owner's public slug (it is
 *   the "Preview my page" button flow). The editor calls THIS one from a `fetch`, then
 *   sets the iframe `src` itself; a redirect here would just make the browser download
 *   draft HTML the editor immediately throws away. A bare `204` is the correct
 *   acquire-the-cookie-and-nothing-else shape.
 * - NO CANDIDATE-TEMPLATE COOKIE: `enable` reads an optional `?template=` to preview a
 *   PROSPECTIVE template. The live-preview pane always renders the COMMITTED template
 *   (D-09), so this route reads no `?template=` and sets no `preview-template` cookie.
 * - NO DISABLE COUNTERPART (D-15): draft mode is NEVER torn down on unmount — the
 *   `__prerender_bypass` cookie is browser-WIDE, so disabling it here would break a
 *   sibling "View my page" tab. The existing `/api/preview/disable` flow stays the one
 *   and only disable path. This route is purely additive: it does not touch the
 *   existing enable/disable pair.
 *
 * SECURITY (threat register T-27-04 — Elevation of Privilege):
 * - OWNER-ONLY via `getVerifiedClaims()` (verified JWT via getClaims) — NEVER
 *   getSession() (AUTH-05). A missing `sub` HARD-FAILS with `401` and an empty body
 *   (no redirect, no detail leak) — never `sub ?? ''`.
 * - Enabling draft mode for the verified caller is harmless: it can only ever reveal
 *   the CALLER'S OWN draft. The page's owner-read (`getPortfolioOwnerByUsername`,
 *   RLS + `claims.sub`) re-confirms ownership at render time, so no client value can
 *   widen what the cookie unlocks.
 *
 * NEXT 16 ASYNC API (CLAUDE.md): `draftMode()` is ASYNC — `await` it, THEN `.enable()`.
 * Draft Mode's `enable()`/`disable()` are Route-Handler-only in Next 16, which is why
 * the preview enable/disable surface lives behind route handlers rather than actions.
 */
import { draftMode } from 'next/headers';

import { getVerifiedClaims } from '@/lib/supabase/server';

export async function GET(): Promise<Response> {
  // (1) Verified identity — no verified `sub` → 401 with no body (NEVER getSession,
  //     NEVER `sub ?? ''`; the hard-fail is the privilege gate, T-27-04).
  const claims = await getVerifiedClaims();
  const sub = (claims as { sub?: string })?.sub;
  if (!sub) return new Response(null, { status: 401 });

  // (2) Enable Draft Mode for the verified owner (sets __prerender_bypass; harmless —
  //     it can only ever reveal THIS caller's own draft, re-confirmed by the page's
  //     RLS owner-read). draftMode() is async in Next 16 — MUST await before .enable().
  const draft = await draftMode();
  draft.enable();

  // (3) Bare 204 — no redirect, no body, no candidate-template cookie. The editor sets
  //     the iframe src itself; there is intentionally NO disable counterpart (D-15).
  return new Response(null, { status: 204 });
}
