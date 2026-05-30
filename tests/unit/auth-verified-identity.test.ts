/**
 * Static source-assertion guard for AUTH-05.
 *
 * Requirement: "Authorization uses verified identity (getClaims()/getUser()),
 * never the spoofable getSession()."
 *
 * Covered files:
 *   - src/lib/supabase/server.ts     (getVerifiedClaims + createClient)
 *   - src/lib/supabase/middleware.ts (updateSession)
 *
 * Strategy: read each source file as raw text and assert on the call-site tokens
 * present/absent. We distinguish a real method call `.getSession(` (dot-prefixed)
 * from prose comments that say `getSession()` (no leading dot), so legitimate
 * "NEVER use getSession()" documentation comments do not produce false positives.
 *
 * This test has no runtime I/O beyond two synchronous fs.readFileSync calls —
 * it belongs to the `unit` project and needs no Docker / Supabase stack.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf-8');
}

// ---------------------------------------------------------------------------
// server.ts — the verified-identity helper consumed by route handlers / actions
// ---------------------------------------------------------------------------

describe('AUTH-05 — server.ts uses verified identity, never spoofable getSession', () => {
  const source = readSource('src/lib/supabase/server.ts');

  it('contains a getClaims() call (verified-identity path is present)', () => {
    // Must call the JWT-verified API
    expect(source).toMatch(/\.getClaims\(/);
  });

  it('does NOT contain a real .getSession( call (spoofable path is absent)', () => {
    // /\.getSession\(/ matches `auth.getSession(` but NOT prose `getSession()`
    expect(source).not.toMatch(/\.getSession\(/);
  });

  it('does NOT export getSession (spoofable API is not part of the public surface)', () => {
    // Match only export-declaration patterns that expose getSession as a name:
    //   export function getSession
    //   export async function getSession
    //   export const getSession
    //   export { ..., getSession, ... }
    // These are all single-line patterns; the multiline comment reference is
    // intentionally excluded because a prose comment is not an export.
    expect(source).not.toMatch(/^export\s+(async\s+)?function\s+getSession\b/m);
    expect(source).not.toMatch(/^export\s+const\s+getSession\b/m);
    expect(source).not.toMatch(/^export\s*\{[^}]*\bgetSession\b[^}]*\}/m);
  });
});

// ---------------------------------------------------------------------------
// middleware.ts — session refresh + route protection
// ---------------------------------------------------------------------------

describe('AUTH-05 — middleware.ts uses verified identity, never spoofable getSession', () => {
  const source = readSource('src/lib/supabase/middleware.ts');

  it('contains a getClaims() call (verified-identity path is present)', () => {
    expect(source).toMatch(/\.getClaims\(/);
  });

  it('does NOT contain a real .getSession( call (spoofable path is absent)', () => {
    expect(source).not.toMatch(/\.getSession\(/);
  });
});
