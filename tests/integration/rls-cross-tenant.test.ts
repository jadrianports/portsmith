/**
 * FND-01 — cross-tenant isolation. RLS is THE tenant boundary: user B's
 * authenticated client must never SELECT, UPDATE, or DELETE user A's rows in
 * any owner-scoped table (portfolios, portfolio_settings, sections, blog_posts,
 * messages, section_history).
 *
 * THE ASYMMETRY (01-RESEARCH Pitfall 3): an RLS-blocked SELECT returns
 * `{ data: [], error: null }` — assert length 0, NEVER `.rejects`. A blocked
 * UPDATE/DELETE silently affects 0 rows (the USING clause filters them out), so
 * we verify "no row changed" by reading the row back with the service-role
 * admin client (which bypasses RLS) — not by inspecting a thrown error.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  adminClient,
  cleanupTestUsers,
  createTestUser,
  type TestUser,
} from './_setup';

const admin = adminClient();
const RUN = Date.now().toString(36);

let userA: TestUser;
let userB: TestUser;
let clientB: SupabaseClient;
let portfolioA: string;
let sectionA: string;
let messageA: string;
let historyRowA: string;

async function signedInClient(user: TestUser): Promise<SupabaseClient> {
  const c = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await c.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  expect(error).toBeNull();
  return c;
}

async function bootstrap(user: TestUser): Promise<string> {
  const owner = await signedInClient(user);
  const { data, error } = await owner.rpc('initialize_portfolio');
  expect(error).toBeNull();
  return data as unknown as string;
}

beforeAll(async () => {
  const aName = `fnd01a${RUN}`.slice(0, 30);
  const bName = `fnd01b${RUN}`.slice(0, 30);

  userA = await createTestUser({
    email: `${aName}@example.test`,
    password: 'Test-Password-123!',
    username: aName,
    display_name: 'FND-01 User A',
  });
  userB = await createTestUser({
    email: `${bName}@example.test`,
    password: 'Test-Password-123!',
    username: bName,
    display_name: 'FND-01 User B',
  });

  portfolioA = await bootstrap(userA);
  await bootstrap(userB);

  clientB = await signedInClient(userB);

  // A section on A (the hero section initialize_portfolio created).
  const { data: sec } = await admin
    .from('sections')
    .select('id')
    .eq('portfolio_id', portfolioA)
    .eq('type', 'hero')
    .single();
  sectionA = sec!.id as string;

  // Seed a message for A via the service role (no public INSERT exists — ADR-004).
  const { data: msg, error: msgErr } = await admin
    .from('messages')
    .insert({
      portfolio_id: portfolioA,
      sender_name: 'Stranger',
      sender_email: 'stranger@example.test',
      subject: 'Hello',
      body: 'A private message for A only.',
    })
    .select('id')
    .single();
  expect(msgErr).toBeNull();
  messageA = msg!.id as string;

  // Drive a content change on A's section so save_section_history writes a row.
  const ownerA = await signedInClient(userA);
  const upd = await ownerA
    .from('sections')
    .update({ content: { heading: 'Changed', subheading: 'history please' } })
    .eq('id', sectionA);
  expect(upd.error).toBeNull();
  const { data: hist } = await admin
    .from('section_history')
    .select('id')
    .eq('section_id', sectionA)
    .limit(1)
    .single();
  historyRowA = hist!.id as string;
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(userA?.id, userB?.id);
});

describe('FND-01 — B cannot SELECT A’s rows (blocked SELECT => [] )', () => {
  it('portfolios', async () => {
    const { data, error } = await clientB
      .from('portfolios')
      .select('*')
      .eq('id', portfolioA);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('portfolio_settings', async () => {
    const { data } = await clientB
      .from('portfolio_settings')
      .select('*')
      .eq('portfolio_id', portfolioA);
    expect(data).toHaveLength(0);
  });

  it('sections', async () => {
    const { data } = await clientB
      .from('sections')
      .select('*')
      .eq('portfolio_id', portfolioA);
    expect(data).toHaveLength(0);
  });

  it('blog_posts', async () => {
    const { data } = await clientB
      .from('blog_posts')
      .select('*')
      .eq('portfolio_id', portfolioA);
    expect(data).toHaveLength(0);
  });

  it('messages', async () => {
    const { data } = await clientB
      .from('messages')
      .select('*')
      .eq('portfolio_id', portfolioA);
    expect(data).toHaveLength(0);
  });

  it('section_history', async () => {
    const { data } = await clientB
      .from('section_history')
      .select('*')
      .eq('section_id', sectionA);
    expect(data).toHaveLength(0);
  });
});

describe('FND-01 — B cannot UPDATE/DELETE A’s rows (0 rows changed)', () => {
  it('B UPDATE of A’s section changes nothing', async () => {
    await clientB
      .from('sections')
      .update({ content: { hacked: true } })
      .eq('id', sectionA);

    // Verify via admin (bypasses RLS): A's section content is untouched.
    const { data } = await admin
      .from('sections')
      .select('content')
      .eq('id', sectionA)
      .single();
    expect((data!.content as Record<string, unknown>).hacked).toBeUndefined();
  });

  it('B DELETE of A’s section removes nothing', async () => {
    await clientB.from('sections').delete().eq('id', sectionA);
    const { data } = await admin
      .from('sections')
      .select('id')
      .eq('id', sectionA);
    expect(data).toHaveLength(1); // still there
  });

  it('B UPDATE of A’s message changes nothing', async () => {
    await clientB
      .from('messages')
      .update({ is_read: true })
      .eq('id', messageA);
    const { data } = await admin
      .from('messages')
      .select('is_read')
      .eq('id', messageA)
      .single();
    expect(data!.is_read).toBe(false);
  });

  it('B DELETE of A’s message removes nothing', async () => {
    await clientB.from('messages').delete().eq('id', messageA);
    const { data } = await admin
      .from('messages')
      .select('id')
      .eq('id', messageA);
    expect(data).toHaveLength(1);
  });

  it('B DELETE of A’s portfolio removes nothing', async () => {
    await clientB.from('portfolios').delete().eq('id', portfolioA);
    const { data } = await admin
      .from('portfolios')
      .select('id')
      .eq('id', portfolioA);
    expect(data).toHaveLength(1);
  });
});

describe('FND-01 — sanity: section_history seed row exists for A', () => {
  it('admin can see A’s captured history row (control)', async () => {
    const { data } = await admin
      .from('section_history')
      .select('id')
      .eq('id', historyRowA);
    expect(data).toHaveLength(1);
  });
});
