/**
 * Unit coverage for the migration-026 OAuth provisional-username mechanism
 * (D-05 / CR-03).
 *
 * Two pure, no-I/O concerns are pinned here (the `unit` vitest project, `node`
 * env, no live stack):
 *
 *   (1) RESERVED-ARRAY SYNC (CR-03): the migration's `v_reserved TEXT[]` plpgsql
 *       array literal MUST equal `RESERVED_USERNAMES` in
 *       `src/lib/validations/username.ts` byte-for-byte (same membership). The
 *       trigger is the DB-level signup gate — if the two drift, a name reserved
 *       in app code could be minted as a real `/[username]` slug by the OAuth
 *       create path (or vice-versa). This reads the migration file as TEXT and
 *       regex-extracts the `v_reserved` literal, then asserts set equality.
 *
 *   (2) DERIVATION RULES (D-05): the email-local-part → handle derivation the
 *       trigger performs, mirrored as a pure TS helper exercised against a small
 *       fixture table (lowercase → strip to [a-z0-9-] → must start with a letter
 *       → 'user' fallback when < 3 chars → 30-char cap). This documents and
 *       pins the rules the plpgsql implements; the live collision-suffix loop is
 *       proven by the integration test (it needs the DB).
 *
 * RED STATE: until `supabase/migrations/026_oauth_provisional_username.sql`
 * exists with a parseable `v_reserved` literal, the sync test ERRORS/fails — the
 * intended Wave-0 RED.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { RESERVED_USERNAMES } from '@/lib/validations/username';

const MIGRATION_PATH = fileURLToPath(
  new URL(
    '../../../supabase/migrations/026_oauth_provisional_username.sql',
    import.meta.url,
  ),
);

/**
 * Read the migration and extract the membership of the FIRST `v_reserved TEXT[]
 * := ARRAY[ ... ]` literal as a Set of the quoted string entries. Throws a
 * legible error (not an opaque undefined) if the literal is absent — that error
 * IS the RED signal before migration 026 lands.
 */
function parseReservedArray(): Set<string> {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const match = sql.match(/v_reserved\s+TEXT\[\]\s*:=\s*ARRAY\[([\s\S]*?)\]/i);
  if (!match) {
    throw new Error(
      'Could not locate a `v_reserved TEXT[] := ARRAY[ ... ]` literal in ' +
        '026_oauth_provisional_username.sql — the migration must mirror ' +
        'RESERVED_USERNAMES (CR-03).',
    );
  }
  const entries = [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
  return new Set(entries);
}

/**
 * Pure TS mirror of the trigger's base-derivation rules (NOT the collision-suffix
 * loop, which needs the DB). Matches the plpgsql:
 *   lower(split_part(email,'@',1)) → strip to [a-z0-9-] → strip leading non-letters
 *   → 'user' fallback if < 3 chars → left(.,30).
 */
function deriveBaseHandle(email: string): string {
  const localPart = (email.split('@')[0] ?? '').toLowerCase();
  let base = localPart.replace(/[^a-z0-9-]/g, ''); // charset
  base = base.replace(/^[^a-z]+/, ''); // must start with a letter
  if (base.length < 3) base = 'user'; // safe fallback
  return base.slice(0, 30); // length cap
}

describe('migration 026 — v_reserved mirrors RESERVED_USERNAMES (CR-03)', () => {
  it('parses a v_reserved array literal from the migration', () => {
    const parsed = parseReservedArray();
    expect(parsed.size).toBeGreaterThan(0);
  });

  it('the parsed array set === RESERVED_USERNAMES (byte-for-byte membership)', () => {
    const parsed = parseReservedArray();
    const tsSet = new Set(RESERVED_USERNAMES);

    // Same size and same membership in BOTH directions (no drift either way).
    expect(parsed.size).toBe(tsSet.size);
    for (const name of tsSet) {
      expect(parsed.has(name)).toBe(true);
    }
    for (const name of parsed) {
      expect(tsSet.has(name)).toBe(true);
    }
    // Sorted-array equality as a single legible assertion.
    expect([...parsed].sort()).toEqual([...tsSet].sort());
  });
});

describe('D-05 — provisional handle base derivation (pure mirror)', () => {
  it.each([
    // [email, expected base]
    ['janedoe@gmail.com', 'janedoe'],
    ['john.doe@gmail.com', 'johndoe'], // dots stripped
    ['John.Doe@Example.com', 'johndoe'], // lowercased
    ['jane+promo@gmail.com', 'janepromo'], // plus-tag char stripped
    ['a@gmail.com', 'user'], // < 3 chars → fallback
    ['12345@gmail.com', 'user'], // strips leading digits → empty → fallback
    ['7james@gmail.com', 'james'], // strips the leading non-letter
    ['', 'user'], // no email → fallback
  ])('derives base "%s" → "%s"', (email, expected) => {
    expect(deriveBaseHandle(email)).toBe(expected);
  });

  it('caps the base at 30 characters', () => {
    const long = `${'a'.repeat(50)}@gmail.com`;
    expect(deriveBaseHandle(long)).toHaveLength(30);
  });

  it('a derived base is never a reserved name without suffixing (sanity)', () => {
    // The base derivation alone does not guarantee non-reserved-ness — the
    // collision-suffix loop (DB) does. But a plain derived base that HAPPENS to
    // be reserved (e.g. email local-part "admin") must be caught downstream; this
    // documents that the base CAN be reserved and the loop is what saves it.
    expect(deriveBaseHandle('admin@gmail.com')).toBe('admin');
    expect(RESERVED_USERNAMES.has('admin')).toBe(true);
  });
});
