import 'server-only';

/**
 * Server-only Cloudflare Turnstile verifier (AUTH-01, D-05 / T-02-09).
 *
 * `import 'server-only'` (the FIRST line, intentionally) turns any attempt to
 * import this module from a Client Component into a BUILD ERROR — the
 * compile-time wall that keeps `TURNSTILE_SECRET_KEY` out of every browser
 * bundle (same FND-05 discipline as service-role.ts:1). CI also greps
 * `.next/static` for secrets as a regression backstop.
 *
 * The token is verified with a raw `fetch` POST to Cloudflare `siteverify` — NO
 * SDK (CLAUDE.md). The widget callback alone is NOT a gate: a bot can call
 * `auth.signUp` directly, so the server boundary owns this check (D-05). The
 * token is single-use, expires in 300s, and a replay returns
 * `error-codes: ['timeout-or-duplicate']` (Pitfall 5).
 *
 * Returns `true` ONLY on `{ success: true }`; any failure, error response, or
 * thrown fetch resolves to `false` (fail-closed — a verification that can't be
 * proven is treated as not-verified).
 */
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface SiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

export async function verifyTurnstile(token: string, remoteip?: string): Promise<boolean> {
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip,
      }),
    });
    const data = (await res.json()) as SiteverifyResponse;
    return data.success === true;
  } catch {
    // Network/parse failure — fail closed (treat as unverified).
    return false;
  }
}
