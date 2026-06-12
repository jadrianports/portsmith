/**
 * The one-shot onboarding-skip cookie contract (18-03 / D-04 / ONB-05) — a single
 * source of truth shared by the two modules that touch it:
 *   - `/api/onboarding/skip`  SETS it (a soft-skip: the owner chooses to skip the
 *     wizard and go straight to the editor for ONE visit),
 *   - `/dashboard` RSC gate   READS-AND-CLEARS it (one-shot) before deciding
 *     wizard-vs-editor.
 *
 * Co-located here (not exported from a `route.ts`) so the dashboard gate imports
 * the constant + the pure predicate WITHOUT importing a route module (mirrors the
 * `PREVIEW_TEMPLATE_COOKIE` idiom in `src/lib/preview/cookie.ts`).
 *
 * SEMANTICS (D-04 — soft-skip stays RESUMABLE):
 * - The cookie carries NO identity and NO authz — it is a pure UX bypass that only
 *   lets the OWNER skip THEIR OWN onboarding for exactly one visit. The skip route
 *   does NOT stamp `onboarded_at`, so the durable "have you finished?" answer is
 *   unchanged: the gate re-fires on the NEXT visit (cookie gone, `onboarded_at`
 *   still null) and routes the soft-skipper back to `/onboarding` until they
 *   actually publish (`markOnboardedAndPublish`, 18-01).
 * - It is set httpOnly + sameSite=lax + path=/ + a short maxAge (one-shot anyway),
 *   so it is unreadable from client JS and cannot be replayed to bypass anything
 *   security-relevant (T-18-skip).
 */
export const ONBOARDING_SKIP_COOKIE = 'onboarding-skip';

/**
 * The PURE first-run routing predicate (D-02): does this load route the caller into
 * the onboarding wizard rather than the raw editor?
 *
 * Extracted as a pure function (no request scope) so the full ONB-02 + ONB-05
 * truth-table is unit-/integration-assertable WITHOUT a `next/headers` request
 * context (which has no scope in the vitest `node` project). The dashboard RSC
 * supplies the two inputs from the verified own-row read + the one-shot cookie.
 *
 * Truth table:
 *   - `onboardedAt == null` & NO skip cookie  → TRUE  (route to /onboarding — the
 *     not-yet-onboarded first-run case, ONB-02).
 *   - `onboardedAt == null` & skip cookie set → FALSE (the soft-skipper reaches the
 *     editor for THIS one visit; the gate clears the cookie so the NEXT visit
 *     re-fires — ONB-05 one-shot, loop-free).
 *   - `onboardedAt` non-null (published/finished) → FALSE (a finished user is NEVER
 *     forced back — ONB-05; no loop. The founder backfill in 18-01 makes this
 *     belt-and-suspenders).
 *
 * The redirect TARGET is always the literal internal `/onboarding` (decided by the
 * caller, never a client-supplied destination) — no open redirect (T-18-redirect).
 *
 * @param onboardedAt the owner's `profiles.onboarded_at` (null = not yet onboarded).
 * @param skipCookiePresent whether the one-shot `onboarding-skip` cookie is present
 *   on THIS request (the gate reads it, then clears it).
 */
export function shouldRedirectToOnboarding(
  onboardedAt: string | null,
  skipCookiePresent: boolean,
): boolean {
  return onboardedAt == null && !skipCookiePresent;
}
