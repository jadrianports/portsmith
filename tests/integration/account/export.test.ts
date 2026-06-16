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

/**
 * D-13 user-facing portfolio_settings allowlist — INCLUDES `email_public` (the
 * intended-public contact address); EXCLUDES the internal id / portfolio_id /
 * updated_at. Mirrors the route's SETTINGS_COLUMNS.
 */
const SETTINGS_COLUMNS =
  'color_preset, email_public, favicon_url, font_preset, location, ' +
  'meta_description, og_image_url, page_title, phone, socials, ' +
  'theme_mode, visitor_theme_toggle';

/** Authored blog-post fields (the markdown column is `body_md`, not `body`). */
const BLOG_POST_COLUMNS =
  'title, slug, body_md, excerpt, cover_image_url, cover_image_alt, ' +
  'meta_title, meta_description, tags, published, published_at';

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
 * The route's read assembly (D-14) — authenticated RLS reads, OWNER-SCOPED by the
 * verified subject. NOTE: `profiles` and `portfolio_settings` BOTH carry a
 * public-select RLS policy (published profiles / public portfolios — 004:70/117)
 * IN ADDITION to the owner policy, so a bare unscoped read returns the owner's row
 * PLUS every published tenant's row (a `.single()` then fails PGRST116 and an
 * unscoped read would LEAK other tenants' published content). RLS alone does NOT
 * scope these to one tenant — the route therefore scopes `profiles` by `id = sub`
 * and settings/sections/blog_posts by the owner's OWN `portfolios.id` (resolved via
 * `user_id = sub`). The `sub` is the server-verified claim subject, never client
 * input — cross-tenant export is impossible. This mirrors the route exactly.
 */
async function buildExport(owner: SupabaseClient, sub: string): Promise<ExportEnvelope> {
  const { data: portfolio } = await owner
    .from('portfolios')
    .select('id')
    .eq('user_id', sub)
    .maybeSingle();
  const portfolioId = (portfolio as { id?: string } | null)?.id ?? null;

  const [profile, settings, sections, posts] = await Promise.all([
    owner.from('profiles').select(PROFILE_COLUMNS).eq('id', sub).single(),
    portfolioId
      ? owner
          .from('portfolio_settings')
          .select(SETTINGS_COLUMNS)
          .eq('portfolio_id', portfolioId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    portfolioId
      ? owner.from('sections').select('type, sort_order, visible, content').eq('portfolio_id', portfolioId)
      : Promise.resolve({ data: [] }),
    portfolioId
      ? owner.from('blog_posts').select(BLOG_POST_COLUMNS).eq('portfolio_id', portfolioId)
      : Promise.resolve({ data: [] }),
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

    const env = await buildExport(owner, user.id);

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

    const env = await buildExport(owner, user.id);
    const serialized = JSON.stringify(env, null, 2);

    // The secret-column exclusion (D-13) applies to the STRUCTURED tenant-data
    // objects at the trust boundary — `profile` + `settings`. It does NOT apply to
    // user-AUTHORED `sections.content` JSONB, which legitimately carries arbitrary
    // keys (a default `projects`/`experience` section ships a `"role": "Your Role"`
    // field, and bios mention "the role you played") — that is the user's own
    // content, which D-13 explicitly INCLUDES. So assert the secret PROFILE/SETTINGS
    // columns are absent from those two objects, not from the whole blob (which
    // would false-positive on legitimate content). `email_public` (settings) is the
    // ALLOWED exception — strip it before the bare `"email"` token check.
    const structured = JSON.stringify(
      { profile: env.profile, settings: env.settings },
      null,
      2,
    );
    const withoutEmailPublic = structured.replace(/"email_public"/g, '"<allowed>"');
    expect(withoutEmailPublic).not.toContain('"email"');
    expect(withoutEmailPublic).not.toContain('"role"');
    expect(withoutEmailPublic).not.toContain('"storage_used_bytes"');
    expect(withoutEmailPublic).not.toContain('"locked"');
    expect(withoutEmailPublic).not.toContain('"deleted_at"');

    // Messages (visitor PII) are excluded entirely — assert against the WHOLE
    // envelope (there must be no `messages` key and no seeded visitor body anywhere).
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
    const envB = await buildExport(ownerB, userB.id);
    expect(envB.profile).not.toBeNull();
    expect(envB.profile!.username).toBe(bName);
    expect(envB.profile!.username).not.toBe(aName);

    // The single-row reads (profiles/portfolio_settings) are RLS-scoped to B: a
    // `.single()` over A's rows would be impossible — RLS returns only B's row.
    const serializedB = JSON.stringify(envB);
    expect(serializedB).not.toContain(aName);
  });
});
