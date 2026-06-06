// GATE-04 — RED scaffold (Wave 0, Plan 12-01). GREENED BY 12-02
// (migration 012 adds `template_grants admin all` RLS + the
// `fallback_ungranted_to_editorial(p_template_id)` SECURITY DEFINER RPC; the
// existing `templates admin all` 004:239 already covers the visibility UPDATE) and
// 12-05 (the `/admin/templates` actions that DRIVE these writes). The data-layer
// guarantees this proves — admin-RLS grant/revoke, the is_admin()-gated cross-user
// auto-fallback, flip→public keeps grants — green the moment 012 lands.
//
// Live-stack proof of the GATE-04 operator-only gating + lossless auto-fallback,
// using `setupAdminUser` (Task-1) + `setupTwoUsers`. The auto-fallback losslessness
// reuses `template-switch-rls.test.ts`'s before/after `sections` snapshot rigor
// (content rows byte-for-byte unchanged); `adminClient` is READ-BACK ONLY.
//
//   (1) admin-RLS grant write: the ADMIN client can INSERT + DELETE a
//       `template_grants` row (the `template_grants admin all` policy), while a
//       NON-admin client's INSERT is REJECTED (RLS denial — operator-only, no
//       self-grant; RESEARCH Rec 2 / D-P12-16).
//   (2) auto-fallback losslessness: `fallback_ungranted_to_editorial(minimal)`,
//       called by the admin, repoints an UNGRANTED user's
//       `portfolios.template_id` → editorial …0002, sets `template_fallback_at`
//       non-null, RETURNS that user's username, and leaves the user's `sections`
//       rows byte-for-byte unchanged (D-P12-10 / RESEARCH Rec 4).
//   (3) non-admin RPC call REJECTED: the inner `is_admin()` self-gate RAISEs for a
//       non-admin invoker (DEFINER bypasses RLS, so the body self-gates).
//   (4) flip→public keeps grants (D-P12-15): an admin UPDATE of
//       `templates.visibility='public'` does NOT delete grant rows (count
//       before == count after).
//
// ── WHY RED NOW (and tsc stays 0) ─────────────────────────────────────────────
// TODAY there is NO `template_grants` table, NO `template_fallback_at` column, NO
// `fallback_ungranted_to_editorial` RPC, and NO `visibility` column — so the admin
// INSERT errors (relation absent), the RPC call errors (function absent), and the
// flip UPDATE errors (column absent). RED for the RIGHT reason (the asserted
// schema/policy/RPC are absent), NOT an import or stack-connection error. 12-02
// applies 011-013 + regenerates `database.ts`, greening the data layer.
//
// `tsc --noEmit` stays 0: imports are existing fixtures only; new-shape table/RPC
// access is untyped string table/function access (the generated `Database` type
// does not yet carry these).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  adminClient,
  setupAdminUser,
  setupTwoUsers,
  teardownAdminUser,
  teardownTwoUsers,
  type AdminUser,
  type TwoUsers,
} from './_cms-fixtures';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);

// Pinned literal UUIDs — MUST equal registry.ts TEMPLATE_UUIDS (registry.ts:73-80).
const MINIMAL_UUID = '00000000-0000-4000-8000-000000000001'; // restricted (D-P12-04)
const EDITORIAL_UUID = '00000000-0000-4000-8000-000000000002'; // public — the fallback target

type SectionRow = {
  id: string;
  type: string;
  content: unknown;
  sort_order: number;
  visible: boolean;
};

let ctx: TwoUsers;
let adminUser: AdminUser;

beforeAll(async () => {
  ctx = await setupTwoUsers('tgadmin', RUN);
  adminUser = await setupAdminUser('tgadmin', RUN);
}, 45_000);

afterAll(async () => {
  // Best-effort grant cleanup (relation may not exist yet — ignore errors).
  await admin.from('template_grants').delete().eq('template_id', MINIMAL_UUID).eq('user_id', ctx.userA.id);
  await teardownAdminUser(adminUser);
  await teardownTwoUsers(ctx);
});

describe('GATE-04 — admin grant/revoke + auto-fallback + flip-keeps-grants (GREENED BY 12-02/12-05)', () => {
  it('admin can INSERT + DELETE a grant; a NON-admin INSERT is REJECTED (operator-only)', async () => {
    // Clean slate.
    await admin.from('template_grants').delete().eq('template_id', MINIMAL_UUID).eq('user_id', ctx.userA.id);

    // (a) ADMIN INSERT succeeds under `template_grants admin all`.
    const ins = await adminUser.client
      .from('template_grants')
      .insert({ template_id: MINIMAL_UUID, user_id: ctx.userA.id });
    expect(ins.error).toBeNull();

    // (b) A NON-admin (user B) INSERT of a grant is REJECTED by RLS (no self-grant,
    //     no operator powers). Either an RLS error OR 0 rows persisted for B's attempt.
    const nonAdminTarget = ctx.userB.id;
    await ctx.clientB
      .from('template_grants')
      .insert({ template_id: MINIMAL_UUID, user_id: nonAdminTarget });
    const { data: bRows } = await admin
      .from('template_grants')
      .select('template_id, user_id')
      .eq('template_id', MINIMAL_UUID)
      .eq('user_id', nonAdminTarget);
    expect((bRows ?? []).length).toBe(0); // B could not create a grant

    // (c) ADMIN DELETE removes the grant it created.
    const del = await adminUser.client
      .from('template_grants')
      .delete()
      .eq('template_id', MINIMAL_UUID)
      .eq('user_id', ctx.userA.id);
    expect(del.error).toBeNull();
  });

  it('fallback_ungranted_to_editorial repoints an ungranted user → editorial, losslessly, returning the username', async () => {
    // Put user A on minimal WITHOUT a grant (the ungranted-restricted condition).
    // Service-role write (read-back/setup only — RLS-bypassing seed of the precondition).
    await admin.from('template_grants').delete().eq('template_id', MINIMAL_UUID).eq('user_id', ctx.userA.id);
    const set = await admin
      .from('portfolios')
      .update({ template_id: MINIMAL_UUID })
      .eq('user_id', ctx.userA.id);
    expect(set.error).toBeNull();

    // Snapshot A's content rows BEFORE the fallback (losslessness proof; content,
    // not just row count).
    const { data: before } = await admin
      .from('sections')
      .select('id, type, content, sort_order, visible')
      .eq('portfolio_id', ctx.portfolioA)
      .order('sort_order', { ascending: true });
    const beforeRows = (before ?? []) as SectionRow[];
    expect(beforeRows.length).toBeGreaterThan(0);

    // The ADMIN invokes the auto-fallback RPC for the minimal template.
    // RED now: the function does not exist.
    const { data: moved, error: rpcError } = await adminUser.client.rpc(
      'fallback_ungranted_to_editorial',
      { p_template_id: MINIMAL_UUID },
    );
    expect(rpcError).toBeNull();
    const usernames = ((moved ?? []) as { username: string }[]).map((r) => r.username);
    expect(usernames).toContain(ctx.userA.username); // returns the affected username

    // A's portfolio is now on editorial, with template_fallback_at set.
    const { data: pf } = await admin
      .from('portfolios')
      .select('template_id, template_fallback_at')
      .eq('user_id', ctx.userA.id)
      .single();
    expect((pf as { template_id?: string } | null)?.template_id).toBe(EDITORIAL_UUID);
    expect((pf as { template_fallback_at?: string | null } | null)?.template_fallback_at).not.toBeNull();

    // ...and EVERY content row is byte-for-byte identical (lossless — only template_id moved).
    const { data: after } = await admin
      .from('sections')
      .select('id, type, content, sort_order, visible')
      .eq('portfolio_id', ctx.portfolioA)
      .order('sort_order', { ascending: true });
    expect((after ?? []) as SectionRow[]).toEqual(beforeRows);
  });

  it('a NON-admin invoking the fallback RPC is REJECTED (inner is_admin() self-gate)', async () => {
    // User B (non-admin) attempts the cross-user RPC — the body's is_admin() RAISEs.
    // RED now: the function does not exist (so this errors for a different reason
    // today); once 12-02 ships it, the non-admin call must be REJECTED (error set).
    const { error } = await ctx.clientB.rpc('fallback_ungranted_to_editorial', {
      p_template_id: MINIMAL_UUID,
    });
    expect(error).not.toBeNull();
  });

  it('flip→public KEEPS the grant rows (D-P12-15 — count unchanged)', async () => {
    // Seed a grant on minimal, count grants, flip minimal→public, count again.
    await adminUser.client
      .from('template_grants')
      .insert({ template_id: MINIMAL_UUID, user_id: ctx.userA.id });

    const countGrants = async (): Promise<number> => {
      const { data } = await admin
        .from('template_grants')
        .select('template_id, user_id')
        .eq('template_id', MINIMAL_UUID);
      return (data ?? []).length;
    };
    const before = await countGrants();
    expect(before).toBeGreaterThan(0);

    // Flip minimal → public via the admin-RLS UPDATE (existing `templates admin all`).
    const flip = await adminUser.client
      .from('templates')
      .update({ visibility: 'public' })
      .eq('id', MINIMAL_UUID);
    expect(flip.error).toBeNull();

    // D-P12-15: flipping to public does NOT delete grants (restored on re-restrict).
    const after = await countGrants();
    expect(after).toBe(before);

    // Restore minimal → restricted so this test leaves no cross-test residue.
    await adminUser.client
      .from('templates')
      .update({ visibility: 'restricted' })
      .eq('id', MINIMAL_UUID);
  });
});

// Gap-closure (post-UAT, commits cc7724e + 014) — regressions for two runtime bugs the
// action-level tests above could not catch: the /admin panel READ (getTemplateGating's
// grants embed) and the revoke-confirm impact semantics (D-P12-11).
describe('GATE-04 gap-closure — grants-embed disambiguation + revoke-aware impact', () => {
  afterAll(async () => {
    await admin.from('template_grants').delete().eq('template_id', MINIMAL_UUID).eq('user_id', ctx.userA.id);
    await admin.from('portfolios').update({ template_id: EDITORIAL_UUID }).eq('user_id', ctx.userA.id);
  });

  it('grants embed disambiguates the grantee FK; the bare profiles(...) embed is ambiguous', async () => {
    // Seed one grant so there is a row to embed.
    await admin.from('template_grants').delete().eq('template_id', MINIMAL_UUID).eq('user_id', ctx.userA.id);
    await adminUser.client
      .from('template_grants')
      .insert({ template_id: MINIMAL_UUID, user_id: ctx.userA.id });

    // (a) the DISAMBIGUATED embed getTemplateGating() uses — pins the GRANTEE FK
    //     (template_grants has TWO FKs to profiles: user_id + granted_by). Returns the
    //     grantee profile. This is the exact shape the /admin/templates panel renders.
    const ok = await adminUser.client
      .from('template_grants')
      .select('template_id, user_id, granted_at, profiles!template_grants_user_id_fkey(username, email)')
      .eq('template_id', MINIMAL_UUID)
      .eq('user_id', ctx.userA.id);
    expect(ok.error).toBeNull();
    const row = (ok.data ?? [])[0] as unknown as { profiles: { username: string } | null } | undefined;
    expect(row?.profiles?.username).toBe(ctx.userA.username);

    // (b) the AMBIGUOUS bare embed (the pre-fix form) MUST error — PostgREST cannot
    //     pick between the user_id and granted_by relationships. This is the bug that
    //     silently collapsed the admin panel to an empty list.
    const ambiguous = await adminUser.client
      .from('template_grants')
      .select('template_id, profiles(username)')
      .eq('template_id', MINIMAL_UUID);
    expect(ambiguous.error).not.toBeNull();
  });

  it('count_orphaned_if_revoked counts the revokee that count_ungranted_on_template misses', async () => {
    // userA: granted minimal AND on minimal → revoking their grant WOULD orphan them.
    // userB: explicitly on editorial → never a confound in the minimal orphan set.
    await admin.from('template_grants').delete().eq('template_id', MINIMAL_UUID).eq('user_id', ctx.userA.id);
    await adminUser.client
      .from('template_grants')
      .insert({ template_id: MINIMAL_UUID, user_id: ctx.userA.id });
    await admin.from('portfolios').update({ template_id: MINIMAL_UUID }).eq('user_id', ctx.userA.id);
    await admin.from('portfolios').update({ template_id: EDITORIAL_UUID }).eq('user_id', ctx.userB.id);

    // OLD read (currently-ungranted set, read PRE-revoke): userA is still granted →
    // NOT counted → 0. This is exactly why the revoke confirm was skipped.
    const ungranted = await adminUser.client.rpc('count_ungranted_on_template', {
      p_template_id: MINIMAL_UUID,
    });
    expect(ungranted.error).toBeNull();
    expect(Number(((ungranted.data ?? [])[0] as { n: number })?.n)).toBe(0);

    // NEW read (post-revoke orphan set): userA IS counted (they'd be orphaned) and
    // returned by username → the confirm now fires.
    const orphaned = await adminUser.client.rpc('count_orphaned_if_revoked', {
      p_template_id: MINIMAL_UUID,
      p_user_id: ctx.userA.id,
    });
    expect(orphaned.error).toBeNull();
    const oRow = (orphaned.data ?? [])[0] as { n: number; usernames: string[] };
    expect(Number(oRow?.n)).toBeGreaterThanOrEqual(1);
    expect(oRow?.usernames).toContain(ctx.userA.username);

    // Revoking userB (NOT on minimal) orphans no one on minimal — userB never appears.
    const forB = await adminUser.client.rpc('count_orphaned_if_revoked', {
      p_template_id: MINIMAL_UUID,
      p_user_id: ctx.userB.id,
    });
    expect(forB.error).toBeNull();
    expect(((forB.data ?? [])[0] as { usernames: string[] })?.usernames ?? []).not.toContain(
      ctx.userB.username,
    );
  });

  it('a NON-admin invoking count_orphaned_if_revoked is REJECTED (inner is_admin() self-gate)', async () => {
    const { error } = await ctx.clientB.rpc('count_orphaned_if_revoked', {
      p_template_id: MINIMAL_UUID,
      p_user_id: ctx.userB.id,
    });
    expect(error).not.toBeNull();
  });
});
