/**
 * D-10 / MEDIA-01 — TS<->SQL quota-constant drift canary (Pitfall 5).
 *
 * The per-user storage cap is hand-duplicated across two languages: the TS
 * `QUOTA_BYTES` constant (src/lib/media/upload-config.ts) and the SQL `quota`
 * CONSTANT in the BEFORE-INSERT trigger function (the latest being migration
 * 031_storage_quota_raise_65mib.sql). There is no clean way to share a TS constant
 * into SQL, so a future cap change must touch BOTH — this test fails loudly if they
 * drift. It asserts:
 *   - TS QUOTA_BYTES === 68157440 (65 MiB)
 *   - migration 031's text CONTAINS 68157440
 *   - migration 031's text contains NO stray 26214400 (the old 25 MiB literal)
 *
 * Reads the migration file off disk (node-unit project) — no DB connection needed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { QUOTA_BYTES } from '@/lib/media/upload-config';

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase',
  'migrations',
  '031_storage_quota_raise_65mib.sql',
);

describe('D-10 / MEDIA-01 — TS<->SQL quota constant linkage', () => {
  it('the TS QUOTA_BYTES is 68157440 (65 MiB)', () => {
    expect(QUOTA_BYTES).toBe(68157440);
  });

  it('migration 031 hard-codes the same 68157440 constant', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    expect(sql).toContain('68157440');
    expect(sql).toContain(String(QUOTA_BYTES));
  });

  it('migration 031 carries NO stray old 26214400 (25 MiB) literal', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    expect(sql).not.toContain('26214400');
  });
});
