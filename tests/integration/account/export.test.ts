/**
 * ACCT-04 — export portfolio content as downloadable JSON (D-13/D-14).
 *
 * WAVE-0 RED SCAFFOLD. The product surface is the authenticated route
 * `GET /api/account/export` (D-14) — not built yet. This scaffold drives the
 * EXACT RLS owner reads the route assembles (the RESEARCH code example) on the
 * authenticated (signed-in) client, builds the same envelope, and asserts:
 *
 *   1. SHAPE — { export_version, exported_at, profile, settings, sections,
 *      blog_posts }; `profile` carries ONLY the non-secret content columns
 *      (username, display_name, headline, avatar_url, resume_url); `sections`
 *      includes HIDDEN sections (visible:false).
 *   2. NO SECRET LEAK — the serialized string must NOT contain `"email"`,
 *      `"role"`, `"storage_used_bytes"`, `"locked"` (except `email_public` inside
 *      settings — an intended-public contact address), and must NOT contain
 *      `messages` (visitor PII is excluded by D-13).
 *   3. RLS ISOLATION — the read uses the AUTHENTICATED client (NOT service-role);
 *      RLS scopes it to the owner's own portfolio, so user B reading "their" export
 *      can never see user A's rows (no app-side tenant filter; RLS is the boundary).
 *
 * Read on the authenticated client mirrors inbox.ts (RLS owner read, no
 * portfolio_id filter in app code). LOCAL STACK ONLY — `*@example.test` reserved.
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

const admin = adminClient();
const RUN = crypto.randomUUID().slice(0, 8);
const createdIds: string[] = [];

const PASSWORD = 'Test-Password-123!';

/** Non-secret profile content columns (D-13 allowlist). */
const PROFILE_COLUMNS = 'username, display_name, headline, avatar_url, resume_url';

interface ExportEnvelope {
  export_version: number;
  exported_at: string;
  profile: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  sections: Record<string, unknown>[] | null;
  blog_posts: Record<string, unknown>[] | null;
}

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

/**
 * The route's read assembly (D-14) — authenticated RLS reads, no tenant filter in
 * app code (RLS scopes each read to the caller's own portfolio).
 */
async function buildExport(owner: SupabaseClient): Promise<ExportEnvelope> {
  const [profile, settings, sections, posts] = await Promise.all([
    owner.from('profiles').select(PROFILE_COLUMNS).single(),
    owner.from('portfolio_settings').select('*').single(),
    owner.from('sections').select('type, sort_order, visible, content'),
    owner
      .from('blog_posts')
      .select(
        'title, slug, body_md, excerpt, cover_image_url, cover_image_alt, meta_title, meta_description, tags, published, published_at',
      ),
  ]);
  return {
    export_version: 1,
    exported_at: new Date().toISOString(),
    profile: (profile.data as Record<string, unknown> | null) ?? null,
    settings: (settings.data as Record<string, unknown> | null) ?? null,
    sections: (sections.data as Record<string, unknown>[] | null) ?? null,
    blog_posts: (posts.data as Record<string, unknown>[] | null) ?? null,
  };
}

beforeAll(async () => {
  await sweepLeftoverTestUsers();
}, 30_000);

afterAll(async () => {
  await cleanupTestUsers(...createdIds.filter(Boolean));
});

describe('ACCT-04 — export shape + non-secret allowlist (D-13)', () => {
  it('envelope has the content keys; profile excludes secret columns; hidden sections included', async () => {
    const name = `exp${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: PASSWORD,
      username: name,
      display_name: 'Exporter',
    });
    createdIds.push(user.id);
    const owner = await signIn(user);

    const { data: pid } = await owner.rpc('initialize_portfolio');
    expect(pid).toBeTruthy();

    // Hide one section so we can prove hidden sections are still exported.
    await owner
      .from('sections')
      .update({ visible: false })
      .eq('portfolio_id', pid as unknown as string)
      .eq('type', 'about');

    const env = await buildExport(owner);

    // Envelope shape.
    expect(env.export_version).toBe(1);
    expect(typeof env.exported_at).toBe('string');
    expect(env).toHaveProperty('profile');
    expect(env).toHaveProperty('settings');
    expect(env).toHaveProperty('sections');
    expect(env).toHaveProperty('blog_posts');

    // Profile = non-secret content columns only.
    expect(env.profile).not.toBeNull();
    expect(Object.keys(env.profile!).sort()).toEqual(
      ['avatar_url', 'display_name', 'headline', 'resume_url', 'username'].sort(),
    );

    // Hidden sections are included (D-13: "all sections incl. hidden").
    const hidden = (env.sections ?? []).filter((s) => s.visible === false);
    expect(hidden.length).toBeGreaterThan(0);
  });
});

describe('ACCT-04 — serialized export leaks no secret columns and excludes messages', () => {
  it('the JSON string contains no email/role/storage_used_bytes/locked and no messages', async () => {
    const name = `exps${RUN}`.slice(0, 30);
    const user = await createTestUser({
      email: `${name}@example.test`,
      password: PASSWORD,
      username: name,
      display_name: 'Exporter Secrets',
    });
    createdIds.push(user.id);
    const owner = await signIn(user);
    const { data: pid } = await owner.rpc('initialize_portfolio');

    // Seed a contact message — it must NOT appear in the export (D-13: visitor PII).
    await admin.from('messages').insert({
      portfolio_id: pid as unknown as string,
      sender_name: 'Visitor',
      sender_email: 'visitor@example.test',
      body: 'should never be exported',
    });

    const serialized = JSON.stringify(await buildExport(owner), null, 2);

    // Secret columns must be absent. `email_public` (settings) is the ALLOWED
    // exception — strip it before asserting on the bare `"email"` token so the
    // intended-public contact address doesn't trip the secret check.
    const withoutEmailPublic = serialized.replace(/"email_public"/g, '"<allowed>"');
    expect(withoutEmailPublic).not.toContain('"email"');
    expect(withoutEmailPublic).not.toContain('"role"');
    expect(withoutEmailPublic).not.toContain('"storage_used_bytes"');
    expect(withoutEmailPublic).not.toContain('"locked"');
    expect(withoutEmailPublic).not.toContain('"deleted_at"');

    // Messages (visitor PII) are excluded entirely.
    expect(serialized).not.toContain('"messages"');
    expect(serialized).not.toContain('should never be exported');
  });
});

describe('ACCT-04 — RLS isolation: user B cannot export user A (D-14)', () => {
  it("B's authenticated export read returns B's own rows only, never A's", async () => {
    const aName = `expa${RUN}`.slice(0, 30);
    const bName = `expb${RUN}`.slice(0, 30);
    const userA = await createTestUser({
      email: `${aName}@example.test`,
      password: PASSWORD,
      username: aName,
      display_name: 'Export Tenant A',
    });
    const userB = await createTestUser({
      email: `${bName}@example.test`,
      password: PASSWORD,
      username: bName,
      display_name: 'Export Tenant B',
    });
    createdIds.push(userA.id, userB.id);

    const ownerA = await signIn(userA);
    const ownerB = await signIn(userB);
    await ownerA.rpc('initialize_portfolio');
    await ownerB.rpc('initialize_portfolio');

    // B's export, read on B's authenticated client, contains B's profile — never A's.
    const envB = await buildExport(ownerB);
    expect(envB.profile).not.toBeNull();
    expect(envB.profile!.username).toBe(bName);
    expect(envB.profile!.username).not.toBe(aName);

    // The single-row reads (profiles/portfolio_settings) are RLS-scoped to B: a
    // `.single()` over A's rows would be impossible — RLS returns only B's row.
    const serializedB = JSON.stringify(envB);
    expect(serializedB).not.toContain(aName);
  });
});
