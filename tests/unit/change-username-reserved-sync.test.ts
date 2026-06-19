/**
 * CR-03 — the 027 change_username RPC's reserved array stays in sync with
 * RESERVED_USERNAMES (Wave-0 RED). Mirrors tests/unit/auth/oauth-handle-derive.test.ts.
 *
 * The Phase-30 `change_username` RPC (migration 027) re-validates format + reserved
 * as the DB backstop (CR-03 — a direct PostgREST RPC call bypasses app code). Its
 * `v_reserved TEXT[]` plpgsql literal MUST equal `RESERVED_USERNAMES` in
 * `src/lib/validations/username.ts` byte-for-byte. If the two drift, a name reserved
 * in app code could slip through the RPC (or a name allowed in app code be rejected
 * at the DB). This reads the migration as TEXT and regex-extracts the literal, then
 * asserts set equality in BOTH directions.
 *
 * RED STATE: `supabase/migrations/027_username_change.sql` does not exist yet — the
 * parse throws a legible "could not locate" error, which IS the intended Wave-0 RED.
 * Plan 02 lands 027 with a parseable `v_reserved` literal and this flips GREEN.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { RESERVED_USERNAMES } from '@/lib/validations/username';

const MIGRATION_PATH = fileURLToPath(
  new URL('../../supabase/migrations/027_username_change.sql', import.meta.url),
);

/**
 * Read the 027 migration and extract the membership of the `v_reserved TEXT[] :=
 * ARRAY[ ... ]` literal as a Set of the quoted string entries. Throws a legible
 * error (not an opaque undefined) when the migration / literal is absent — that
 * error IS the RED signal before migration 027 lands.
 */
function parseReservedArray(): Set<string> {
  let sql: string;
  try {
    sql = readFileSync(MIGRATION_PATH, 'utf8');
  } catch {
    throw new Error(
      '027_username_change.sql does not exist yet (Wave-0 RED) — Plan 02 creates ' +
        'the change_username RPC whose v_reserved array must mirror RESERVED_USERNAMES (CR-03).',
    );
  }
  const match = sql.match(/v_reserved\s+TEXT\[\]\s*:=\s*ARRAY\[([\s\S]*?)\]/i);
  if (!match) {
    throw new Error(
      'Could not locate a `v_reserved TEXT[] := ARRAY[ ... ]` literal in ' +
        '027_username_change.sql — the change_username RPC must mirror ' +
        'RESERVED_USERNAMES byte-for-byte (CR-03).',
    );
  }
  const entries = [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
  return new Set(entries);
}

describe('migration 027 — change_username v_reserved mirrors RESERVED_USERNAMES (CR-03)', () => {
  it('parses a v_reserved array literal from the 027 migration', () => {
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
