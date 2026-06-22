'use server';

/**
 * draft-share-action — the owner's revocable draft-share token write (DIST-02 /
 * D-01 / D-02 / D-03 / SHARED-A). Two owner actions:
 *
 *   - `generateDraftShare()` mints (or ROTATES) the single per-portfolio draft-share
 *     token: a 256-bit server-minted opaque token, a fixed ~7-day expiry, active
 *     (`revoked_at = null`). UPSERT keyed on `portfolio_id` (the table PK, D-03) so a
 *     second generate overwrites the row in place — the old token stops resolving
 *     INSTANTLY (a single rotating link, never a pile of tokens).
 *   - `revokeDraftShare()` kills the active token INSTANTLY by stamping `revoked_at`
 *     (D-01) — a DB-backed revocable token, NOT a stateless JWT that lives until
 *     expiry. The token read (`get-portfolio-by-draft-token.ts`) treats a non-null
 *     `revoked_at` as dead, so the recipient route 404s immediately.
 *
 * This mirrors `set-showcase-action.ts` EXACTLY — a single-purpose, own-row write
 * under AUTHENTICATED RLS — with the ONE addition the showcase opt-in does not need:
 * a server-side token mint via `crypto.randomBytes(32)` (V6 — NEVER `Math.random`).
 *
 * Canonical SHARED-A sequence (the server boundary OWNS the gate; a failure at step N
 * never reaches step N+1):
 *
 *   1. getVerifiedClaims() — verified JWT identity (AUTH-05). NEVER getSession()
 *      (unverified, spoofable). A null claim ⇒ { ok: false }.
 *   2. WR-05 explicit `sub` guard — a verified claim MUST carry a subject. A missing
 *      `sub` is a HARD auth failure; NEVER coerce it to '' (which would scope the
 *      write to a non-existent row and silently affect 0 rows).
 *   3. AUTHENTICATED RLS write — `await createClient()` (NEVER `supabaseAdmin`). The
 *      owner's `draft_shares own all` policy (EXISTS join on
 *      `portfolios.user_id = auth.uid()`) scopes the write to THEIR portfolio; a
 *      cross-tenant attempt silently changes 0 rows (T-33-02). EXPLICIT column
 *      allowlist — never a spread. The token READ (the recipient is anonymous, no
 *      session) is the ONLY service-role path; the owner write is ALWAYS RLS.
 *   4. Return the discriminated union (`{ ok: true, url, expiresAt }` on generate so
 *      the Share panel can show the link WITHOUT a path revalidate; `{ ok: true }` on
 *      revoke). No `revalidatePath` — the share link is dashboard UI, not an ISR page.
 *
 * Source: the SHARED-A skeleton + result-union shape from set-showcase-action.ts; the
 * `draft_shares` token store from migration 030 (33-01); 33-PATTERNS.md §draft-share-action.
 */
import { randomBytes } from 'node:crypto';

import { createClient, getVerifiedClaims } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/url';

/**
 * The generate/revoke outcome — a discriminated union (SHARED-A). On a successful
 * generate it carries the recipient `url` (`siteUrl('/draft/' + token)`, host-
 * independent — D-06) + the `expiresAt` ISO string so the Share panel renders the
 * live link without a revalidate. A revoke returns the bare `{ ok: true }` shape.
 */
export type DraftShareResult =
  | { ok: true; url: string; expiresAt: string }
  | { ok: false; error?: string };

/** Revoke returns the bare success shape (no url/expiry to surface). */
export type RevokeDraftShareResult = { ok: true } | { ok: false; error?: string };

const NOT_SIGNED_IN = 'Not signed in.';
const NO_PORTFOLIO = 'No portfolio to share yet.';
const SAVE_FAILED = 'We couldn’t create your draft link. Please try again.';
const REVOKE_FAILED = 'We couldn’t revoke your draft link. Please try again.';

/** D-02: every generated link auto-expires ~7 days out (fixed, not owner-selectable). */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The outcome of resolving the caller's own portfolio id (WR-03). A discriminated union
 * so callers can tell the THREE conditions apart — previously a bare `null` conflated a
 * transient DB read error with "owner has no portfolio yet", which let `revokeDraftShare`
 * report a false `{ ok: true }` on a read error (a leaked link believed dead but still live):
 *   - `found`  — the owner has a portfolio; `id` is its PK.
 *   - `none`   — the owner genuinely has no portfolio yet (a clean, non-error empty read).
 *   - `error`  — the read FAILED (transient DB error); the caller must NOT treat this as a
 *               no-op success.
 */
type ResolvePortfolioResult =
  | { status: 'found'; id: string }
  | { status: 'none' }
  | { status: 'error' };

/**
 * Resolve the AUTHENTICATED caller's OWN portfolio id (RLS-scoped to their row). Returns a
 * discriminated {@link ResolvePortfolioResult} (WR-03) so a transient read error is never
 * confused with "no portfolio yet". Used by both actions to key the `draft_shares` write on
 * the owner's portfolio (PK = portfolio_id, D-03) WITHOUT trusting any client-supplied id.
 */
async function resolveOwnPortfolioId(
  db: Awaited<ReturnType<typeof createClient>>,
  sub: string,
): Promise<ResolvePortfolioResult> {
  // RLS scopes this to the caller's own portfolio (portfolios.user_id = auth.uid()).
  const { data, error } = await db
    .from('portfolios')
    .select('id')
    .eq('user_id', sub) // WR-05: `sub` guaranteed present (no `?? ''`).
    .maybeSingle();
  if (error) return { status: 'error' }; // WR-03: a read error is NOT "no portfolio".
  if (!data?.id) return { status: 'none' };
  return { status: 'found', id: data.id };
}

/**
 * Mint (or ROTATE) the owner's single draft-share token (D-03). A 256-bit opaque
 * token, a fixed ~7-day expiry (D-02), active. UPSERT on `portfolio_id` (the PK)
 * overwrites the existing row in place, so the previous token stops resolving the
 * instant this returns.
 */
export async function generateDraftShare(): Promise<DraftShareResult> {
  // 1) Verified identity (AUTH-05 — never getSession).
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // 2) WR-05: a verified claim MUST carry a subject — a missing `sub` is a hard auth
  //    failure (NEVER coerce to '', which would scope the write to a non-existent row).
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 3) AUTHENTICATED RLS write (NEVER supabaseAdmin — the owner write goes through
  //    their own_all policy; only the recipient READ is service-role).
  const supabase = await createClient();
  const resolved = await resolveOwnPortfolioId(supabase, sub);
  // WR-03: distinguish a transient read error (retry) from "no portfolio yet".
  if (resolved.status === 'error') return { ok: false, error: SAVE_FAILED };
  if (resolved.status === 'none') return { ok: false, error: NO_PORTFOLIO };
  const portfolioId = resolved.id;

  // Server-minted 256-bit token (V6 — NEVER Math.random). base64url → a 43-char,
  // URL-safe opaque string matching the read's `/^[A-Za-z0-9_-]{43}$/` format gate.
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();

  // UPSERT keyed on portfolio_id (the PK, D-03) — rotates the single link in place,
  // killing the old token. EXPLICIT column allowlist (never a spread). `revoked_at`
  // is reset to null so a re-generate after a revoke re-activates the (new) link.
  const { error } = await supabase
    .from('draft_shares')
    .upsert(
      {
        portfolio_id: portfolioId,
        token,
        expires_at: expiresAt,
        revoked_at: null,
      },
      { onConflict: 'portfolio_id' },
    );
  if (error) return { ok: false, error: SAVE_FAILED };

  // 4) Return the live link (host-independent siteUrl — D-06) + expiry so the Share
  //    panel updates WITHOUT a path revalidate (the link is dashboard UI, not ISR).
  return { ok: true, url: siteUrl('/draft/' + token), expiresAt };
}

/**
 * Revoke the owner's active draft-share token INSTANTLY (D-01) by stamping
 * `revoked_at`. The read enforces revoke (a non-null `revoked_at` → null → 404), so a
 * leaked-but-revoked link is dead immediately. A revoke with no active row is a no-op
 * success (the link is already gone). Cross-tenant: RLS scopes to the owner's own row.
 */
export async function revokeDraftShare(): Promise<RevokeDraftShareResult> {
  // 1) Verified identity (AUTH-05 — never getSession).
  const claims = await getVerifiedClaims();
  if (!claims) return { ok: false, error: NOT_SIGNED_IN };

  // 2) WR-05 hard `sub` guard (never `?? ''`).
  const sub = (claims as { sub?: string }).sub;
  if (!sub) return { ok: false, error: NOT_SIGNED_IN };

  // 3) AUTHENTICATED RLS write (NEVER supabaseAdmin). Stamp revoked_at on the owner's
  //    own row — RLS scopes it to their portfolio; a cross-tenant target affects 0 rows.
  const supabase = await createClient();
  const resolved = await resolveOwnPortfolioId(supabase, sub);
  // WR-03: a transient read error must NOT masquerade as a successful revoke — for a
  // security-revoke control ("kill this leaked link now"), a false `{ ok: true }` would
  // tell the owner the link is dead while it stays live for its full 7-day expiry. Surface
  // a generic retryable failure so the owner re-attempts the revoke.
  if (resolved.status === 'error') return { ok: false, error: REVOKE_FAILED };
  // No portfolio (and thus no draft_shares row) → genuinely nothing to revoke → success.
  if (resolved.status === 'none') return { ok: true };
  const portfolioId = resolved.id;

  const { error } = await supabase
    .from('draft_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('portfolio_id', portfolioId);
  if (error) return { ok: false, error: REVOKE_FAILED };

  return { ok: true };
}
