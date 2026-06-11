import 'server-only';

/**
 * Salted client-IP hash for the report per-sender rate-limit subject (SAFE-03 / R-5
 * / D-07). `import 'server-only'` (FIRST line) keeps this — and the secret it reads
 * — out of EVERY client bundle (the `turnstile.ts:1` / `service-role.ts:1`
 * discipline; the FND-05 CI greps `.next/static` for un-prefixed secrets).
 *
 * THE LOAD-BEARING PRIVACY INVARIANT (T-06-16 / D-07): the raw IP is PII and is
 * NEVER returned or stored. We HMAC it with a server-only secret and return ONLY the
 * hex digest, which becomes the `rate_limit_events.subject` for `bucket='report_sender'`.
 * HMAC-SHA256 via Node's built-in `crypto` — never hand-roll a hash, and no library
 * is needed (the route is `runtime='nodejs'`, so `node:crypto` is available).
 *
 * DEGRADATION (R-5 / A3): returns `null` when there is no client IP OR when
 * `REPORT_IP_HASH_SECRET` is unset. The route treats a `null` subject as "skip the
 * per-sender cap" — Turnstile (the primary gate) and the per-page cap still apply.
 * D-07 explicitly treats the IP cap as a minor trivial-flood speed-bump, so a missing
 * secret never blocks a legitimate reporter.
 *
 * `REPORT_IP_HASH_SECRET` is a NEW server-only secret — un-prefixed, NEVER
 * `NEXT_PUBLIC_` (the checkpoint:human-verify in 06-06 sets it in Vercel + .env.local).
 */
import { headers } from 'next/headers';
import { createHmac } from 'node:crypto';

/**
 * Derive the per-sender rate-limit subject from the request's client IP.
 *
 * Reads `x-forwarded-for` and takes the FIRST comma-separated entry (the client on
 * Vercel — the same idiom `signup-action.ts:61` uses for Turnstile `remoteip`),
 * falling back to `x-real-ip`. Returns the HMAC-SHA256 hex digest of that IP, or
 * `null` to signal "skip the per-sender cap" (no IP, or no secret configured).
 */
export async function hashClientIp(req: Request): Promise<string | null> {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = fwd?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? null;
  if (!ip) return null;

  // Un-prefixed, server-only secret. Absent → degrade (skip the per-sender cap, R-5).
  const secret = process.env.REPORT_IP_HASH_SECRET;
  if (!secret) return null;

  // Store/return ONLY the digest — the raw IP never leaves this function (D-07).
  return createHmac('sha256', secret).update(ip).digest('hex');
}

/**
 * D-11 / HARD-04 — the Server-Action variant of `hashClientIp(req)`.
 *
 * Pitfall 1: Server Actions (`signupAction` / `loginAction` / `requestReset`)
 * receive `input: unknown`, NOT a `Request` — so `hashClientIp(req)` can't be
 * reused as-is. This sibling reads the client IP via `await headers()` from
 * `next/headers` (the same `clientIp()` idiom signup-action.ts:61-70 already uses
 * for Turnstile `remoteip`), then applies the EXACT same HMAC + same secret +
 * same degrade-to-null contract as `hashClientIp`.
 *
 * Same privacy invariant (D-07): the raw IP is PII and is NEVER returned or
 * stored — only the hex digest, which becomes the `rate_limit_events.subject` for
 * the new `auth_signup`/`auth_login`/`auth_reset` buckets. Same degrade (R-5):
 * returns `null` when there is no client IP OR `REPORT_IP_HASH_SECRET` is unset,
 * which the auth actions treat as "skip the per-IP cap" — a missing secret never
 * locks out a real user.
 *
 * (`next/headers` is server-only; the `import 'server-only'` on line 1 already
 * enforces that. The existing `hashClientIp(req)` is unaffected.)
 */
export async function hashClientIpFromHeaders(): Promise<string | null> {
  let ip: string | null = null;
  try {
    const h = await headers();
    const fwd = h.get('x-forwarded-for');
    ip = fwd?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
  } catch {
    ip = null;
  }
  if (!ip) return null;

  // Un-prefixed, server-only secret. Absent → degrade (skip the per-IP cap, R-5).
  const secret = process.env.REPORT_IP_HASH_SECRET;
  if (!secret) return null;

  // Store/return ONLY the digest — the raw IP never leaves this function (D-07).
  return createHmac('sha256', secret).update(ip).digest('hex');
}
