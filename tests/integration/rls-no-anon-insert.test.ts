/**
 * ADR-004 — the contact-form `messages` table (and page_views) has NO INSERT
 * policy: a table with RLS enabled and no INSERT policy denies all inserts, so
 * only the server-side service-role contact route can write a message. A public
 * INSERT policy would let anyone with the (public) anon key POST straight to
 * PostgREST, bypassing Turnstile + rate limiting. This proves the anon INSERT
 * is denied.
 *
 * Also proves the templates surface: anon CAN read an active template (public
 * SELECT where is_active = true) but CANNOT write templates (admin-only).
 *
 * NOTE on the insert assertion: a blocked INSERT under RLS surfaces as a
 * non-null `error` (a 42501 / "violates row-level security policy"), so here we
 * assert error non-null AND confirm via the service-role admin client that no
 * row was actually created — belt and suspenders.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  adminClient,
  anonClient,
  cleanupTestUsers,
  createTestUser,
  sweepLeftoverTestUsers,
  type TestUser,
} from './_setup';

const anon = anonClient();
const admin = adminClient();
// WR-09: collision-proof per-run token (see _setup.ts sweepLeftoverTestUsers).
const RUN = crypto.randomUUID().slice(0, 8);

let userA: TestUser;
let portfolioA: string;
const SENTINEL = `anon-insert-sentinel-${RUN}`;

beforeAll(async () => {
  // WR-09: purge leftover *@example.test users from an aborted prior run.
  await sweepLeftoverTestUsers();
  const name = `adr004${RUN}`.slice(0, 30);
  userA = await createTestUser({
    email: `${name}@example.test`,
    password: 'Test-Password-123!',
    username: name,
    display_name: 'ADR-004 User A',
  });

  const owner: SupabaseClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  await owner.auth.signInWithPassword({
    email: userA.email,
    password: userA.password,
  });
  const { data, error } = await owner.rpc('initialize_portfolio');
  expect(error).toBeNull();
  portfolioA = data as unknown as string;
}, 30_000);

afterAll(async () => {
  // Remove any sentinel row that should never have been created, then the user.
  await admin.from('messages').delete().eq('body', SENTINEL);
  await cleanupTestUsers(userA?.id);
});

describe('ADR-004 — anon cannot INSERT into messages', () => {
  it('anon INSERT into messages is rejected and creates no row', async () => {
    const { error } = await anon.from('messages').insert({
      portfolio_id: portfolioA,
      sender_name: 'Attacker',
      sender_email: 'attacker@example.test',
      subject: 'bypass',
      body: SENTINEL,
    });

    // No INSERT policy => RLS denies => non-null error.
    expect(error).not.toBeNull();

    // And definitively: no such row exists (checked with the service role).
    const { data } = await admin
      .from('messages')
      .select('id')
      .eq('body', SENTINEL);
    expect(data ?? []).toHaveLength(0);
  });
});

describe('templates — anon read-only', () => {
  it('anon CAN read the active minimal template', async () => {
    const { data, error } = await anon
      .from('templates')
      .select('slug, is_active')
      .eq('slug', 'minimal');
    expect(error).toBeNull();
    expect(data && data.length).toBeGreaterThan(0);
    expect(data![0].is_active).toBe(true);
  });

  it('anon CANNOT INSERT a template', async () => {
    const { error } = await anon.from('templates').insert({
      slug: `evil-${RUN}`,
      name: 'Evil',
      spec: {},
    });
    expect(error).not.toBeNull();
    const { data } = await admin
      .from('templates')
      .select('id')
      .eq('slug', `evil-${RUN}`);
    expect(data ?? []).toHaveLength(0);
  });

  it('anon CANNOT UPDATE a template (0 rows changed)', async () => {
    await anon
      .from('templates')
      .update({ name: 'Hijacked' })
      .eq('slug', 'minimal');
    // Verify via admin the name is unchanged.
    const { data } = await admin
      .from('templates')
      .select('name')
      .eq('slug', 'minimal')
      .single();
    expect(data!.name).not.toBe('Hijacked');
  });

  it('anon CANNOT DELETE a template (still present)', async () => {
    await anon.from('templates').delete().eq('slug', 'minimal');
    const { data } = await admin
      .from('templates')
      .select('id')
      .eq('slug', 'minimal');
    expect(data ?? []).toHaveLength(1);
  });
});
