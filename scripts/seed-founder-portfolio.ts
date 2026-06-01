/**
 * scripts/seed-founder-portfolio.ts — the idempotent founder-portfolio seed
 * (Plan 03-03, TMPL-03; D-01/D-02).
 *
 * WHAT IT DOES: populates James's REAL developer-founder portfolio — `profiles`
 * (published) + `portfolios` + `portfolio_settings` + `sections` — from the typed
 * `FOUNDER` fixture in `./seed/founder-content`. There is no CMS yet (the editor
 * is Phase 4), so the walking-skeleton content is hand-seeded here. It is the live
 * fixture the public page (03-05) renders and the e2e gate (03-09) loads.
 *
 * IDEMPOTENT: every write is an UPSERT on a natural key (profiles by id,
 * portfolios on user_id, portfolio_settings on portfolio_id, sections on
 * (portfolio_id, type) — the UNIQUE constraints from migration 001 / ADR-011), so
 * re-running it updates rows in place and never duplicates. Run it locally as a
 * dev fixture, and (once a prod project exists) against James's real account.
 *
 * SERVICE-ROLE (the sanctioned privileged path): like `scripts/promote-admin.ts`,
 * this constructs its OWN standalone admin client with `@supabase/supabase-js`. It
 * DELIBERATELY does NOT import `src/lib/supabase/service-role.ts`, because that
 * module begins with `import 'server-only'`, which THROWS when imported outside a
 * Next.js server bundle (i.e. under `tsx`). The service-role key bypasses RLS AND
 * the protected-columns trigger — the only sanctioned way to set
 * `profiles.published = true` (the trigger's service-role short-circuit, Plan
 * 01-09). The key has no NEXT_PUBLIC_ prefix and is never bundled (FND-05 posture);
 * this is a manual, out-of-band tool, NOT runtime app code, and is not imported by
 * any route.
 *
 * ZOD GATE (SHARED-C / critical rule #1): every section's content is validated
 * through `validateSectionContent(type, content)` — the SAME gate the Phase-4 CMS
 * will use — BEFORE it is written. A Zod throw aborts the seed. The seed and the
 * future CMS therefore write IDENTICAL shapes.
 *
 * PROD SOFT TRIPWIRE (RESEARCH Pattern 6 / T-03-09): if NEXT_PUBLIC_SUPABASE_URL
 * is NOT a localhost / 127.0.0.1 URL, the seed REFUSES to write unless an explicit
 * `--confirm-prod` argv flag OR `SEED_TARGET=prod` env is present — so a production
 * write is always intentional, never accidental.
 *
 * CONTENT: comes from the GITIGNORED `scripts/seed/founder-content.ts` (James's
 * real values; copied from the committed `founder-content.example.ts` template and
 * filled in). This file does NOT redefine content inline.
 *
 * USAGE:
 *   Local:  npm run seed:founder                          (URL is localhost → no flag needed)
 *   Prod:   SEED_TARGET=prod npm run seed:founder         (or `npm run seed:founder -- --confirm-prod`)
 */
import { createClient } from '@supabase/supabase-js';
import { validateSectionContent } from '@/lib/validations';
import { FOUNDER } from './seed/founder-content';

// Load .env.local so `npm run seed:founder` works without manual `export`s.
// dotenv is a devDependency; ignore if absent (env may already be exported).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
} catch {
  // dotenv not installed / unavailable — rely on the ambient process env.
}

function fail(message: string): never {
  console.error(`[seed-founder] ERROR: ${message}`);
  process.exit(1);
}

function log(message: string): void {
  console.log(`[seed-founder] ${message}`);
}

/** A localhost / loopback Supabase URL → a SAFE (non-prod) target. */
function isLocalTarget(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i.test(
    url,
  );
}

/**
 * The D-05 section order (Hero → About → Skills → Projects → Experience →
 * Testimonials → Contact). `sort_order` is the index; Testimonials is the only
 * section seeded `visible: false` (D-06 — no placeholder quotes).
 *
 * Content is taken from the FOUNDER fixture. Testimonials carries an empty
 * `items: []` (it is hidden) but still passes the Zod gate.
 */
function buildSections(): { type: string; content: unknown; visible: boolean }[] {
  const s = FOUNDER.sections;
  return [
    { type: 'hero', content: s.hero, visible: true },
    { type: 'about', content: s.about, visible: true },
    { type: 'skills', content: s.skills, visible: true },
    { type: 'projects', content: s.projects, visible: true },
    { type: 'experience', content: s.experience, visible: true },
    // D-06: Testimonials is BUILT but seeded HIDDEN until ≥2 real quotes exist.
    {
      type: 'testimonials',
      content: { heading: 'Testimonials', items: [] },
      visible: false,
    },
    { type: 'contact', content: s.contact, visible: true },
  ];
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    fail('NEXT_PUBLIC_SUPABASE_URL is not set.');
  }
  if (!serviceRoleKey) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY is not set. This script needs the service-role ' +
        'key (server-only, no NEXT_PUBLIC_ prefix) to bypass RLS + the protected-' +
        'columns trigger and set `published`.',
    );
  }

  // --- Prod soft tripwire (T-03-09): a non-localhost target must be confirmed. ---
  const confirmProd =
    process.argv.includes('--confirm-prod') ||
    process.env.SEED_TARGET?.trim().toLowerCase() === 'prod';
  if (!isLocalTarget(supabaseUrl) && !confirmProd) {
    fail(
      `Refusing to seed a NON-LOCAL target (${supabaseUrl}) without explicit ` +
        'confirmation. A production seed must be intentional. Re-run with ' +
        '`SEED_TARGET=prod` (or `npm run seed:founder -- --confirm-prod`) only if ' +
        'you really mean to write to this database.',
    );
  }
  const targetLabel = isLocalTarget(supabaseUrl) ? 'LOCAL' : 'PROD (confirmed)';
  log(`target: ${targetLabel} — ${supabaseUrl}`);

  // Standalone admin client — bypasses RLS + the protected-columns trigger.
  // Stateless: no session persistence, no token refresh.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { username } = FOUNDER;

  // --- 1. Resolve James's user id (his profile must exist). -------------------
  // Look up the LIVE profile by username (the uq_profiles_username_live index).
  let { data: profile, error: lookupError } = await admin
    .from('profiles')
    .select('id, username')
    .eq('username', username)
    .is('deleted_at', null)
    .maybeSingle();

  if (lookupError) {
    fail(`profile lookup failed: ${lookupError.message}`);
  }

  if (!profile) {
    // FRESH-LOCAL bootstrap (mirrors tests/integration/_setup.ts createTestUser):
    // create the auth user so the live `handle_new_user` trigger provisions the
    // profile. The PROD path assumes James signed up normally — so only bootstrap
    // against a LOCAL target; on prod a missing profile is a hard error.
    if (!isLocalTarget(supabaseUrl)) {
      fail(
        `no profile found for username="${username}" on a non-local target. Sign ` +
          'up through the normal flow first, then re-run this seed.',
      );
    }
    log(`no profile for "${username}" — bootstrapping a local auth user…`);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: FOUNDER.bootstrap.email,
      password: FOUNDER.bootstrap.password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: FOUNDER.profile.display_name,
      },
    });
    if (createError || !created.user) {
      fail(
        `bootstrap createUser failed: ${createError?.message ?? 'no user returned'}`,
      );
    }
    // Re-read the profile the trigger just provisioned.
    const reread = await admin
      .from('profiles')
      .select('id, username')
      .eq('id', created.user.id)
      .maybeSingle();
    if (reread.error || !reread.data) {
      fail(
        `profile was not provisioned by handle_new_user for the bootstrapped user: ${
          reread.error?.message ?? 'no profile row'
        }`,
      );
    }
    profile = reread.data;
  }

  const userId = profile.id;
  log(`founder profile resolved: ${username} (${userId})`);

  // --- 2. Update the profiles row (service-role bypasses the protected trigger). --
  // `published: true` is the sanctioned service-role write (Plan 01-09).
  const profileUpdate: Record<string, unknown> = {
    display_name: FOUNDER.profile.display_name,
    headline: FOUNDER.profile.headline,
    resume_url: FOUNDER.profile.resume_url,
    published: true,
    updated_at: new Date().toISOString(),
  };
  if (FOUNDER.profile.avatar_url) {
    profileUpdate.avatar_url = FOUNDER.profile.avatar_url;
  }
  const { error: profileError } = await admin
    .from('profiles')
    .update(profileUpdate)
    .eq('id', userId);
  if (profileError) {
    fail(`profiles update failed: ${profileError.message}`);
  }
  log('profiles row updated (published=true).');

  // --- 3. Resolve the `minimal` template id (FK target for the portfolio). ----
  const { data: template, error: templateError } = await admin
    .from('templates')
    .select('id')
    .eq('slug', 'minimal')
    .maybeSingle();
  if (templateError) {
    fail(`templates lookup failed: ${templateError.message}`);
  }
  if (!template) {
    fail(
      'the `minimal` template row is missing. It is seeded by migration 001 — ' +
        'apply migrations (`supabase db reset`) and re-run.',
    );
  }

  // --- 4. Upsert the portfolio (UNIQUE on user_id → idempotent). --------------
  const { data: portfolio, error: portfolioError } = await admin
    .from('portfolios')
    .upsert(
      {
        user_id: userId,
        template_id: template.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('id')
    .single();
  if (portfolioError || !portfolio) {
    fail(`portfolios upsert failed: ${portfolioError?.message ?? 'no row returned'}`);
  }
  const portfolioId = portfolio.id;
  log(`portfolio upserted: ${portfolioId}`);

  // --- 5. Upsert portfolio_settings (UNIQUE on portfolio_id → idempotent). ----
  // Theme is forced dark + toggle-on; presets explicit (D-15/D-16).
  const { error: settingsError } = await admin.from('portfolio_settings').upsert(
    {
      portfolio_id: portfolioId,
      theme_mode: 'dark',
      visitor_theme_toggle: true,
      color_preset: 'default',
      font_preset: 'default',
      page_title: FOUNDER.settings.page_title,
      meta_description: FOUNDER.settings.meta_description,
      email_public: FOUNDER.settings.email_public,
      github_url: FOUNDER.settings.github_url ?? null,
      linkedin_url: FOUNDER.settings.linkedin_url ?? null,
      twitter_url: FOUNDER.settings.twitter_url ?? null,
      dribbble_url: FOUNDER.settings.dribbble_url ?? null,
      website_url: FOUNDER.settings.website_url ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'portfolio_id' },
  );
  if (settingsError) {
    fail(`portfolio_settings upsert failed: ${settingsError.message}`);
  }
  log('portfolio_settings upserted (theme_mode=dark, visitor_theme_toggle=true).');

  // --- 6. Upsert each section (UNIQUE on (portfolio_id, type) → idempotent). --
  // EVERY section's content is validated through the SAME Zod gate the CMS uses
  // (SHARED-C) BEFORE the write; a Zod throw aborts the seed.
  const sections = buildSections();
  for (let i = 0; i < sections.length; i++) {
    const { type, content, visible } = sections[i];
    let validated: unknown;
    try {
      validated = validateSectionContent(type, content);
    } catch (err) {
      fail(
        `section "${type}" failed the Zod gate: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    const { error: sectionError } = await admin.from('sections').upsert(
      {
        portfolio_id: portfolioId,
        type,
        sort_order: i,
        visible,
        content: validated as never,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'portfolio_id,type' },
    );
    if (sectionError) {
      fail(`section "${type}" upsert failed: ${sectionError.message}`);
    }
    log(
      `section upserted: ${type} (sort_order=${i}, visible=${visible}${
        type === 'testimonials' ? ' — hidden per D-06' : ''
      }).`,
    );
  }

  log(
    `SUCCESS: founder portfolio seeded for "${username}" (${userId}) — published, ` +
      'dark+toggle, Testimonials hidden. Re-run any time; upserts are idempotent.',
  );
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
