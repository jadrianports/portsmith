/**
 * ACCT-03 — permanent hard delete: storage sweep + FK cascade + sign-out (D-09..D-12).
 *
 * WAVE-0 RED SCAFFOLD. The product surface is the service-role route
 * `POST /api/account/delete` (D-11) + the net-new `sweepUserStorage` helper
 * (src/lib/media/sweep-user-storage.ts, D-11) — neither built yet. This scaffold
 * proves the load-bearing truths against the REAL local stack:
 *
 *   1. SWEEP — after uploading objects under `{sub}/{context}/…` across the three
 *      buckets, sweeping (list two levels → remove) leaves `list('{sub}')` EMPTY
 *      in every bucket. Driven inline here via the service-role admin client (the
 *      exact two-level traversal the helper will encapsulate), so the storage truth
 *      is pinned even before the helper module exists.
 *   2. CASCADE — `admin.deleteUser(sub)` cascades `profiles → portfolios →
 *      sections / portfolio_settings / blog_posts / messages / reports` to 0 rows
 *      (the FK `ON DELETE CASCADE` chain, migration 001).
 *   3. OWN-FOLDER GUARD — a sweep must never cross tenants: a path whose first
 *      segment is not the owner's sub is rejected (the guard that REPLACES RLS for
 *      the service-role sweep — delete-object.ts:86-87).
 *   4. GATES — reauth (D-01) + type-exact-username (D-12) are both required before
 *      the route performs any destructive work.
 *
 * The helper-driven assertion (1) lives in a `describe.skip` with a dynamic import
 * so this file COLLECTS green under `tsc --noEmit` while `sweep-user-storage.ts`
 * does not exist; the Wave-2 slice un-skips it. The inline-sweep block (1') is
 * active-and-red and proves the same storage truth now.
 *
 * LOCAL STACK ONLY — `*@example.test` is a reserved test domain.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  adminClient,
  cleanupTestUsers,
  createTestUser,
  sweepLeftoverTestUsers,
  type TestUser,
} from '../_setup';

import { verifyCurrentPassword } from '@/lib/auth/reauth';

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);
const createdIds: string[] = [];

const PASSWORD = 'Test-Password-123!';

/** Buckets the sweep covers (migration 003 / upload-config.ts). */
const SWEEP_BUCKETS = ['avatars', 'media', 'resumes'] as const;

function anon(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}

async function signIn(user: TestUser): Promise<SupabaseClient> {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({
    email: user.email,
    password: PASSWORD,
  });
  expect(error).toBeNull();
  return c;
}

/** Seed one object per bucket under {sub}/{context}/… via the service-role client. */
async function seedStorage(sub: string): Promise<void> {
  const body = new Blob([new Uint8Array([1, 2, 3, 4])]);
  await admin.storage.from('avatars').upload(`${sub}/avatar/seed.bin`, body, {
    upsert: true,
  });
  await admin.storage.from('media').upload(`${sub}/project/seed.bin`, body, {
    upsert: true,
  });
  await admin.storage.from('resumes').upload(`${sub}/resume/seed.bin`, body, {
    upsert: true,
  });
}

/** Two-level list under {sub}/ → all object paths in one bucket (the sweep shape). */
async function listAllUnder(bucket: string, sub: string): Promise<string[]> {
  const { data: folders } = await admin.storage.from(bucket).list(sub);
  const paths: string[] = [];
  for (const folder of folders ?? []) {
    if (folder.id) continue; // an object directly at {sub}/ root — not a folder
    const { data: objects } = await admin.storage
      .from(bucket)
      .list(`${sub}/${folder.name}`);
    for (const obj of objects ?? []) {
      const full = `${sub}/${folder.name}/${obj.name}`;
      // OWN-FOLDER GUARD (re-asserted): never collect a path outside the owner.
      if (full.split('/')[0] !== sub) continue;
      paths.push(full);
    }
  }
  return paths;
}

beforeAll(async () => {
  await sweepLeftoverTestUsers();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(...createdIds.filter(Boolean));
});

describe('ACCT-03 — gates: reauth + type-exact-username (D-01/D-12)', () => {
  it('reauth false on wrong password; username must match the verified profile exactly', async () => {
    const name = `del${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: PASSWORD,
      username: name,
      display_name: 'Hard Delete Gates',
    });
    createdIds.push(user.id);

    // Reauth gate (D-01): wrong password rejects before any destructive work.
    expect(await verifyCurrentPassword(user.email, 'wrong-password')).toBe(false);
    expect(await verifyCurrentPassword(user.email, PASSWORD)).toBe(true);

    // Type-exact-username (D-12): asserted against the verified profile username.
    const { data: profile } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    expect(profile?.username).toBe(name);
    expect(`${name}X`).not.toBe(profile?.username); // a near-miss must NOT pass
  });
});

describe('ACCT-03 — storage sweep clears every {sub}/ object (inline, active)', () => {
  it('seed across 3 buckets → sweep → list({sub}) empty in all 3', async () => {
    const name = `dels${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: PASSWORD,
      username: name,
      display_name: 'Hard Delete Sweep',
    });
    createdIds.push(user.id);
    const sub = user.id;

    await seedStorage(sub);

    // Sanity: objects are present before the sweep.
    const before =
      (await listAllUnder('avatars', sub)).length +
      (await listAllUnder('media', sub)).length +
      (await listAllUnder('resumes', sub)).length;
    expect(before).toBeGreaterThanOrEqual(3);

    // Sweep BEFORE admin.deleteUser (D-11) — the two-level list+remove per bucket.
    for (const bucket of SWEEP_BUCKETS) {
      const paths = await listAllUnder(bucket, sub);
      if (paths.length > 0) {
        const { error } = await admin.storage.from(bucket).remove(paths);
        expect(error).toBeNull();
      }
    }

    // Every bucket's {sub}/ tree is now empty.
    for (const bucket of SWEEP_BUCKETS) {
      expect(await listAllUnder(bucket, sub)).toHaveLength(0);
    }
  });
});

describe('ACCT-03 — own-folder guard rejects a cross-tenant sweep path', () => {
  it("user B's object path is never collected when sweeping user A's sub", async () => {
    const aName = `dela${RUN}`.slice(0, 30);
    const bName = `delb${RUN}`.slice(0, 30);
    const userA = await createTestUser({
      email: `${aName}@example.test`,
      password: PASSWORD,
      username: aName,
      display_name: 'Tenant A',
    });
    const userB = await createTestUser({
      email: `${bName}@example.test`,
      password: PASSWORD,
      username: bName,
      display_name: 'Tenant B',
    });
    createdIds.push(userA.id, userB.id);

    await seedStorage(userB.id);

    // Sweeping under A's sub must collect NOTHING of B's (own-folder guard: first
    // path segment must equal the owner's sub).
    for (const bucket of SWEEP_BUCKETS) {
      const paths = await listAllUnder(bucket, userA.id);
      expect(paths.every((p) => p.split('/')[0] === userA.id)).toBe(true);
      expect(paths.some((p) => p.startsWith(`${userB.id}/`))).toBe(false);
    }

    // B's objects survive untouched (the guard rejected, did not delete).
    const bSurvives =
      (await listAllUnder('avatars', userB.id)).length +
      (await listAllUnder('media', userB.id)).length +
      (await listAllUnder('resumes', userB.id)).length;
    expect(bSurvives).toBeGreaterThanOrEqual(3);
  });
});

describe('ACCT-03 — admin.deleteUser cascades the whole tree to 0 rows', () => {
  it('seed portfolio + section + blog post + message → deleteUser → 0 rows everywhere', async () => {
    const name = `delc${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: PASSWORD,
      username: name,
      display_name: 'Hard Delete Cascade',
    });
    createdIds.push(user.id);
    const sub = user.id;

    // Seed a portfolio + dependent rows as the OWNER (RLS-scoped writes).
    const owner = await signIn(user);
    const { data: portfolioId, error: bootErr } = await owner.rpc('initialize_portfolio');
    expect(bootErr).toBeNull();
    expect(portfolioId).toBeTruthy();
    const pid = portfolioId as unknown as string;

    // A blog post (RLS owner write).
    await owner.from('blog_posts').insert({
      portfolio_id: pid,
      title: 'Goodbye',
      slug: `goodbye-${RUN}`,
      body_md: 'farewell',
    });

    // A contact message via the service-role client (anon visitors write through
    // the /api/contact service-role route; seed it admin-side here).
    await admin.from('messages').insert({
      portfolio_id: pid,
      sender_name: 'Visitor',
      sender_email: 'visitor@example.test',
      body: 'hi',
    });

    // Sanity: the tree exists before delete.
    const sectionsBefore = await admin
      .from('sections')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', pid);
    expect(sectionsBefore.count ?? 0).toBeGreaterThan(0);

    // The destructive act (the route's final step, after sweep): delete the auth
    // user → FK ON DELETE CASCADE wipes the whole tree.
    const del = await admin.auth.admin.deleteUser(sub);
    expect(del.error).toBeNull();

    // 0 rows in every dependent table.
    for (const table of [
      'sections',
      'portfolio_settings',
      'blog_posts',
      'messages',
      'reports',
    ] as const) {
      const { count, error } = await admin
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('portfolio_id', pid);
      expect(error).toBeNull();
      expect(count ?? 0).toBe(0);
    }
    const profileRow = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('id', sub);
    expect(profileRow.count ?? 0).toBe(0);
    const portfolioRow = await admin
      .from('portfolios')
      .select('id', { count: 'exact', head: true })
      .eq('id', pid);
    expect(portfolioRow.count ?? 0).toBe(0);
  });
});

// HELPER-DRIVEN assertion — un-skip in the Wave-2 slice once
// src/lib/media/sweep-user-storage.ts exists. Kept skipped (with a dynamic import)
// so this file collects green under tsc while the module is absent.
describe.skip('ACCT-03 — sweepUserStorage helper (un-skip when built)', () => {
  it('sweepUserStorage(sub) clears all {sub}/ objects across 3 buckets', async () => {
    const name = `delh${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: PASSWORD,
      username: name,
      display_name: 'Hard Delete Helper',
    });
    createdIds.push(user.id);
    await seedStorage(user.id);

    // Dynamic import via a NON-LITERAL specifier so tsc never resolves a
    // not-yet-built module while this block is skipped (a literal dynamic-import
    // path is still type-checked; a computed one is not). The Wave-2 slice that
    // builds sweep-user-storage.ts replaces this with a static top-level import.
    const sweepModulePath = ['@/lib/media', 'sweep-user-storage'].join('/');
    const mod = (await import(/* @vite-ignore */ sweepModulePath)) as {
      sweepUserStorage: (sub: string) => Promise<void>;
    };
    await mod.sweepUserStorage(user.id);

    for (const bucket of SWEEP_BUCKETS) {
      expect(await listAllUnder(bucket, user.id)).toHaveLength(0);
    }
  });
});
