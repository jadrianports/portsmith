/**
 * The preview-candidate cookie contract (07-05 / D-P7-08) — a single source of truth
 * shared by the three modules that touch it:
 *   - `/api/preview/enable`  sets it (on a vetted `?template=<slug>`),
 *   - `/api/preview/disable` clears it,
 *   - `[username]/page.tsx`  reads + re-validates it in the DRAFT branch.
 *
 * Co-located here (not exported from a `route.ts`) so neither the page nor the
 * disable handler imports a route module just for the constant.
 *
 * The cookie carries the slug of the template the owner is PREVIEWING (not yet
 * persisted). It is set httpOnly + sameSite=lax + path=/ so it travels with the draft
 * request to the public slug and is unreadable from client JS. Its value is always
 * `templateSlugSchema`-validated both where it is written and where it is read
 * (defense-in-depth, T-07-13/T-07-14) — a raw/crafted slug never reaches a render path.
 *
 * It rides the EXISTING `__prerender_bypass` draft-cookie dynamic branch only; the
 * public (non-draft) path never reads it, so `/[username]` stays `● SSG` for anonymous
 * visitors (T-07-15 / Pitfall 2).
 */
export const PREVIEW_TEMPLATE_COOKIE = 'preview-template';
