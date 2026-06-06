// GATE-01 — RED scaffold (Wave 0, Plan 12-01). GREENED BY 12-02
// (migration 011 adds `templates.visibility` + the `template_grants` table +
// `portfolios.template_fallback_at`; migration 013 seeds editorial=public,
// minimal/aurora=restricted + the founder→minimal grant; `src/types/database.ts`
// regenerated).
//
// Live-stack proof of the GATE-01 schema + seed shape, read via the service-role
// `adminClient` (RLS-bypassing read-back only — never the boundary write; mirrors
// the `template-switch-rls.test.ts` adminClient snapshot idiom):
//
//   - `templates.visibility` column exists and is readable for all THREE seeded
//     rows (minimal …0001, editorial …0002, aurora …0003 — the pinned literal
//     UUIDs from registry.ts:73-80; these MUST stay consistent or the public read
//     can't resolve template_id → slug, D-22 / Pitfall 3).
//   - `template_grants` table exists with COMPOSITE-PK `(template_id, user_id)`
//     semantics: a round-trip INSERT/SELECT of a grant works, and a DUPLICATE
//     INSERT of the same `(template_id, user_id)` CONFLICTS (the natural key
//     prevents duplicate grants structurally — RESEARCH Rec 2).
//   - Seed state (D-P12-03/04/05): editorial `visibility='public'`, minimal +
//     aurora `visibility='restricted'`, and a founder→minimal grant row present
//     (derived by 013 from the portfolio that points at minimal — never a
//     hardcoded username; RESEARCH Rec 6).
//
// ── WHY RED NOW (and tsc stays 0) ─────────────────────────────────────────────
// TODAY there is NO `visibility` column and NO `template_grants` table — so every
// `.from('template_grants')` / `.select('visibility')` read errors at runtime
// against the live stack (the column/relation does not exist), and the seed
// assertions have nothing to read. This file is RED for the RIGHT reason (the
// asserted live schema is absent), NOT an import typo or a stack-connection error.
// 12-02 applies migrations 011/013 + regenerates `database.ts`, greening it.
//
// `tsc --noEmit` stays 0: the file imports only existing fixtures + the
// `@supabase/supabase-js` client, and every new-shape read is an untyped string
// table/column access (the generated `Database` type does not yet carry
// `template_grants`, so the reads are deliberately written without depending on it).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupTwoUsers,
  teardownTwoUsers,
  type TwoUsers,
} from './_cms-fixtures';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

// The pinned literal UUIDs — MUST equal registry.ts TEMPLATE_UUIDS (registry.ts:73-80).
const MINIMAL_UUID = '00000000-0000-4000-8000-000000000001';
const EDITORIAL_UUID = '00000000-0000-4000-8000-000000000002';
const AURORA_UUID = '00000000-0000-4000-8000-000000000003';

let ctx: TwoUsers;

beforeAll(async () => {
  ctx = await setupTwoUsers('tgschema', RUN);
}, 30_000);

afterAll(async () => {
  // Clean up any grant rows this test inserted (composite-PK round-trip), then users.
  await admin
    .from('template_grants')
    .delete()
    .eq('template_id', MINIMAL_UUID)
    .eq('user_id', ctx.userA.id);
  await teardownTwoUsers(ctx);
});

describe('GATE-01 — templates.visibility + template_grants schema/seed (GREENED BY 12-02)', () => {
  it('templates carries a `visibility` column readable for all three seeded rows', async () => {
    const { data, error } = await admin
      .from('templates')
      .select('id, slug, visibility')
      .in('id', [MINIMAL_UUID, EDITORIAL_UUID, AURORA_UUID]);
    // RED now: there is no `visibility` column → error (column does not exist).
    expect(error).toBeNull();
    const rows = (data ?? []) as { id: string; slug: string; visibility: string }[];
    expect(rows.length).toBe(3);
    for (const r of rows) {
      expect(typeof r.visibility).toBe('string');
      expect(['public', 'restricted']).toContain(r.visibility);
    }
  });

  it('seed: editorial=public, minimal & aurora=restricted (D-P12-03/04/05)', async () => {
    const bySlug = async (slug: string): Promise<string | undefined> => {
      const { data } = await admin
        .from('templates')
        .select('visibility')
        .eq('slug', slug)
        .single();
      return (data as { visibility?: string } | null)?.visibility;
    };
    // RED now: no `visibility` column → these reads error / return undefined.
    expect(await bySlug('editorial')).toBe('public');
    expect(await bySlug('minimal')).toBe('restricted');
    expect(await bySlug('aurora')).toBe('restricted');
  });

  it('template_grants exists with composite-PK semantics (round-trip + duplicate conflicts)', async () => {
    // Clean slate for this user/template pair.
    await admin
      .from('template_grants')
      .delete()
      .eq('template_id', MINIMAL_UUID)
      .eq('user_id', ctx.userA.id);

    // Round-trip INSERT of a (template_id, user_id) grant.
    // RED now: the `template_grants` relation does not exist → error.
    const first = await admin
      .from('template_grants')
      .insert({ template_id: MINIMAL_UUID, user_id: ctx.userA.id });
    expect(first.error).toBeNull();

    const { data: read } = await admin
      .from('template_grants')
      .select('template_id, user_id')
      .eq('template_id', MINIMAL_UUID)
      .eq('user_id', ctx.userA.id);
    expect((read ?? []).length).toBe(1);

    // A DUPLICATE INSERT of the SAME composite key must CONFLICT (PRIMARY KEY
    // (template_id, user_id) — duplicate grants prevented structurally).
    const dup = await admin
      .from('template_grants')
      .insert({ template_id: MINIMAL_UUID, user_id: ctx.userA.id });
    expect(dup.error).not.toBeNull();
  });

  it('seed: a founder→minimal grant row is present (derived from the minimal portfolio)', async () => {
    // 013 grants every portfolio currently on minimal — the founder (the only
    // account on minimal; new accounts default to editorial). Assert at least one
    // grant row exists for the minimal template.
    // RED now: no `template_grants` relation → error / zero rows.
    const { data } = await admin
      .from('template_grants')
      .select('template_id, user_id')
      .eq('template_id', MINIMAL_UUID);
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
