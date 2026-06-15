/**
 * scripts/seed-aurora-demo.ts — the idempotent aurora DEMO-marketer-portfolio seed
 * (Plan 22-02, D-04 / LAND-03). A near-clone of `scripts/seed-founder-portfolio.ts`;
 * only the persona, the template (`aurora` vs `minimal`), and the section set differ.
 *
 * WHAT IT DOES: populates a DEMO marketer portfolio on the `aurora` template —
 * `profiles` (published) + `portfolios` (on aurora) + `portfolio_settings` +
 * `sections` — from the typed `AURORA_DEMO` fixture in `./seed/aurora-content`. The
 * landing page's proof block (LAND-03 / D-04) needs TWO CONTRASTING published
 * showcases: the founder's developer portfolio (`/jadrianports`, edgerunner-v2,
 * showcase #1, already published) and a MARKETER portfolio on aurora (showcase #2).
 * Research verified NO aurora portfolio existed anywhere — this seed creates it at
 * `/aurora-demo` so Plan 04 can screenshot its LIVE page.
 *
 * IDEMPOTENT: every write is an UPSERT on a natural key (profiles by id, portfolios
 * on user_id with `template_id`=aurora set ON INSERT ONLY, portfolio_settings on
 * portfolio_id, sections on (portfolio_id, type) — the UNIQUE constraints from
 * migration 001), so re-running updates rows in place and never duplicates.
 *
 * SERVICE-ROLE (the sanctioned privileged path): like `seed-founder-portfolio.ts`,
 * this constructs its OWN standalone admin client with `@supabase/supabase-js`. It
 * DELIBERATELY does NOT import `src/lib/supabase/service-role.ts`, because that
 * module begins with `import 'server-only'`, which THROWS when imported outside a
 * Next.js server bundle (i.e. under `tsx`). The service-role key bypasses RLS AND
 * the protected-columns trigger — the only sanctioned way to set
 * `profiles.published = true`. The key has no NEXT_PUBLIC_ prefix and is never
 * bundled; this is a manual, out-of-band tool, NOT runtime app code, imported by no
 * route. The demo user is provisioned by `handle_new_user` as `role:'user'` — this
 * seed never sets `role` (T-22-seed-03).
 *
 * ZOD GATE (SHARED-C / critical rule #1): every section's content is validated
 * through `validateSectionContent(type, content)` — the SAME gate the CMS uses —
 * BEFORE it is written; the profile columns go through `profileSchema.parse`. A Zod
 * throw aborts the seed (T-22-seed-02 — the privileged path never bypasses the gate,
 * so a `javascript:`/`data:` URL can never be written).
 *
 * PROD SOFT TRIPWIRE (T-22-seed-01): if NEXT_PUBLIC_SUPABASE_URL is NOT a localhost /
 * 127.0.0.1 URL, the seed REFUSES to write unless an explicit `--confirm-prod` argv
 * flag OR `SEED_TARGET=prod` env is present — so a production write is always
 * intentional, never accidental.
 *
 * AURORA IS RESTRICTED (migrations 011 + 013): aurora's `visibility` is `'restricted'`
 * and it gets NO grant row by default (D-P12-05 — Kyle/marketers are granted manually
 * in /admin). The PUBLIC read path renders any portfolio regardless of grant (it uses
 * the static `slugForTemplateId` map, not a grant check — `get-portfolio.ts`), so the
 * showcase renders without a grant. But to mirror the founder seed's discipline and
 * keep the demo robust if the CMS picker is ever opened on this account, we ALSO
 * upsert a self-healing demo-user→aurora `template_grants` row (the SAME belt-and-
 * suspenders idiom as the founder→minimal/edgerunner grants). ON CONFLICT with
 * ignoreDuplicates makes a re-run a clean no-op.
 *
 * CONTENT: comes from the GITIGNORED `scripts/seed/aurora-content.ts` (the tweakable
 * demo copy; copied from the committed `aurora-content.example.ts` template). This
 * file does NOT redefine content inline.
 *
 * USAGE:
 *   Local:  npm run seed:aurora                          (URL is localhost → no flag needed)
 *   Prod:   SEED_TARGET=prod npm run seed:aurora         (or `npm run seed:aurora -- --confirm-prod`)
 */
import { createClient } from '@supabase/supabase-js';
import { profileSchema, settingsSchema, validateSectionContent } from '@/lib/validations';
import { AURORA_DEMO } from './seed/aurora-content';

// Load .env.local so `npm run seed:aurora` works without manual `export`s.
// dotenv is a devDependency; ignore if absent (env may already be exported).
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
} catch {
  // dotenv not installed / unavailable — rely on the ambient process env.
}

function fail(message: string): never {
  console.error(`[seed-aurora] ERROR: ${message}`);
  process.exit(1);
}

function log(message: string): void {
  console.log(`[seed-aurora] ${message}`);
}

/** A localhost / loopback Supabase URL → a SAFE (non-prod) target. */
function isLocalTarget(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i.test(
    url,
  );
}

/**
 * The marketer section order (Hero → About → Services → Metrics → Testimonials →
 * Projects → Contact). `sort_order` is the index. All sections are seeded visible —
 * this is a complete-looking DEMO showcase (D-04); the demo testimonials are
 * clearly-marked placeholder quotes (NOT the founder's real-portfolio "no placeholder
 * quotes" D-06 rule, which governs his own portfolio only).
 *
 * Content is taken from the AURORA_DEMO fixture; the contact section surfaces the
 * intended-public `email_public` INTO its content (the SAME additive idiom the
 * founder seed uses) so aurora's contact section can render a mailto fallback under
 * the frozen `{ section }` SectionProps contract.
 */
function buildSections(): { type: string; content: unknown; visible: boolean }[] {
  const s = AURORA_DEMO.sections;
  const contactContent = {
    ...s.contact,
    email_public: AURORA_DEMO.settings.email_public,
  };
  return [
    { type: 'hero', content: s.hero, visible: true },
    { type: 'about', content: s.about, visible: true },
    { type: 'services', content: s.services, visible: true },
    { type: 'metrics', content: s.metrics, visible: true },
    { type: 'testimonials', content: s.testimonials, visible: true },
    { type: 'projects', content: s.projects, visible: true },
    { type: 'contact', content: contactContent, visible: true },
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

  // --- Prod soft tripwire (T-22-seed-01): a non-localhost target must be confirmed. ---
  const confirmProd =
    process.argv.includes('--confirm-prod') ||
    process.env.SEED_TARGET?.trim().toLowerCase() === 'prod';
  if (!isLocalTarget(supabaseUrl) && !confirmProd) {
    fail(
      `Refusing to seed a NON-LOCAL target (${supabaseUrl}) without explicit ` +
        'confirmation. A production seed must be intentional. Re-run with ' +
        '`SEED_TARGET=prod` (or `npm run seed:aurora -- --confirm-prod`) only if ' +
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

  const { username } = AURORA_DEMO;

  // --- 1. Resolve the demo user's id (its profile must exist). ----------------
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
    // FRESH-LOCAL bootstrap (mirrors the founder seed / tests/integration/_setup.ts):
    // create the auth user so the live `handle_new_user` trigger provisions the
    // profile (as `role:'user'`). The PROD path assumes the demo account was created
    // through the normal flow — so only bootstrap against a LOCAL target.
    if (!isLocalTarget(supabaseUrl)) {
      fail(
        `no profile found for username="${username}" on a non-local target. Create ` +
          'the demo account through the normal signup flow first, then re-run this seed.',
      );
    }
    log(`no profile for "${username}" — bootstrapping a local auth user…`);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: AURORA_DEMO.bootstrap.email,
      password: AURORA_DEMO.bootstrap.password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: AURORA_DEMO.profile.display_name,
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
  log(`demo profile resolved: ${username} (${userId})`);

  // --- 2. Update the profiles row (service-role bypasses the protected trigger). --
  // The service-role write bypasses RLS + the protected-columns trigger, so the
  // profile columns it sets MUST still pass the SAME Zod gate the CMS uses
  // (`profileSchema`) — `avatar_url` is http(s)-validated so the seed can never write a
  // dangerous-scheme URL into an `<Image src>`. A Zod throw aborts the seed before any
  // write. NOTE: this seed never sets `role` (T-22-seed-03) — the demo user stays
  // `role:'user'` as provisioned by `handle_new_user`.
  let validatedProfile: ReturnType<typeof profileSchema.parse>;
  try {
    validatedProfile = profileSchema.parse({
      username,
      display_name: AURORA_DEMO.profile.display_name,
      headline: AURORA_DEMO.profile.headline,
      avatar_url: AURORA_DEMO.profile.avatar_url ?? '',
    });
  } catch (err) {
    fail(
      `profile columns failed the Zod gate: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // `published: true` is the sanctioned service-role write — REQUIRED or /aurora-demo 404s.
  const profileUpdate: Record<string, unknown> = {
    display_name: validatedProfile.display_name,
    headline: validatedProfile.headline,
    published: true,
    updated_at: new Date().toISOString(),
  };
  if (validatedProfile.avatar_url) {
    profileUpdate.avatar_url = validatedProfile.avatar_url;
  }
  const { error: profileError } = await admin
    .from('profiles')
    .update(profileUpdate)
    .eq('id', userId);
  if (profileError) {
    fail(`profiles update failed: ${profileError.message}`);
  }
  log('profiles row updated (published=true).');

  // --- 3. Resolve the `aurora` template id (FK target for the portfolio). -----
  const { data: template, error: templateError } = await admin
    .from('templates')
    .select('id, visibility')
    .eq('slug', 'aurora')
    .maybeSingle();
  if (templateError) {
    fail(`templates lookup failed: ${templateError.message}`);
  }
  if (!template) {
    fail(
      'the `aurora` template row is missing. It is seeded by migration 010 — ' +
        'apply migrations (`supabase db reset`) and re-run.',
    );
  }
  log(`aurora template resolved: ${template.id} (visibility=${template.visibility}).`);

  // --- 4. Ensure the portfolio (UNIQUE on user_id → idempotent). --------------
  // PRESERVE THE LIVE TEMPLATE CHOICE: a blind UPSERT that always SET
  // `template_id = aurora` would revert any future template the owner picks every
  // re-run. So we set `template_id = aurora` ONLY when CREATING the portfolio; when
  // it already exists we DO NOT touch `template_id`. `template_id` is NOT NULL, so it
  // must be supplied on the initial INSERT.
  let portfolioId: string;
  const { data: existingPortfolio, error: existingPortfolioError } = await admin
    .from('portfolios')
    .select('id, template_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existingPortfolioError) {
    fail(`portfolios lookup failed: ${existingPortfolioError.message}`);
  }
  if (existingPortfolio) {
    // Exists — refresh only `updated_at`; never clobber the live `template_id`.
    const { error: portfolioUpdateError } = await admin
      .from('portfolios')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', existingPortfolio.id);
    if (portfolioUpdateError) {
      fail(`portfolios update failed: ${portfolioUpdateError.message}`);
    }
    portfolioId = existingPortfolio.id;
    log(
      `portfolio refreshed: ${portfolioId} (template_id preserved: ${existingPortfolio.template_id}).`,
    );
  } else {
    // Fresh — create on the aurora template (the demo's whole point is to be ON aurora).
    const { data: createdPortfolio, error: portfolioInsertError } = await admin
      .from('portfolios')
      .insert({
        user_id: userId,
        template_id: template.id,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (portfolioInsertError || !createdPortfolio) {
      fail(`portfolios insert failed: ${portfolioInsertError?.message ?? 'no row returned'}`);
    }
    portfolioId = createdPortfolio.id;
    log(`portfolio created: ${portfolioId} (template_id=aurora).`);
  }

  // --- 4b. Self-healing demo-user→aurora grant (aurora is RESTRICTED). --------
  // RESTRICTED BRANCH: aurora's visibility is `'restricted'` (migrations 011 + 013;
  // confirmed via `template.visibility` above) and it has NO default grant row
  // (D-P12-05). The PUBLIC read path renders the portfolio regardless of grant (it
  // uses the static `slugForTemplateId` map, not a grant check), so the showcase
  // renders WITHOUT this grant. We still upsert it — order-independently, with the
  // script's EXISTING service-role admin client — so the demo account is consistent
  // if the CMS picker/switch gate is ever exercised on it (the SAME belt-and-
  // suspenders idiom as the founder→minimal/edgerunner grants in the founder seed).
  // This is a build/seed script, not a request path — the ONE place a grant write
  // legitimately uses the service-role client. `onConflict` on the composite PK with
  // `ignoreDuplicates` makes a re-run a clean no-op.
  if (template.visibility === 'restricted') {
    const { error: grantError } = await admin.from('template_grants').upsert(
      {
        template_id: template.id,
        user_id: userId,
        granted_by: null,
      },
      { onConflict: 'template_id,user_id', ignoreDuplicates: true },
    );
    if (grantError) {
      fail(`demo-user→aurora template_grants upsert failed: ${grantError.message}`);
    }
    log('demo-user→aurora template_grants upserted (aurora is restricted; self-healing).');
  } else {
    // PUBLIC BRANCH: if aurora were ever promoted to `public`, no grant is needed.
    log(`aurora is ${template.visibility} (not restricted) — no template_grants row needed.`);
  }

  // --- 5. Upsert portfolio_settings (UNIQUE on portfolio_id → idempotent). ----
  // aurora's only presets are `'default'` (color + font) — `aurora/spec.ts`.
  // theme_mode is forced 'light': the DB column DEFAULTS to 'dark', but aurora renders
  // its signature warm/rosy "Aurora Rose" palette in LIGHT mode (it honors theme_mode —
  // `index.tsx`: defaultMode = theme_mode==='dark' ? 'dark' : 'light'). The rosy look is
  // the showcase that makes the dev-vs-marketer contrast pop in the LAND-03 proof block
  // (D-04 "always looks good"); the visitor toggle stays on so dark mode is still reachable.
  // Gate the user-editable settings through the SAME `settingsSchema` the CMS uses
  // (the CR-01 stored-XSS URL gate) BEFORE this service-role write — the privileged
  // path must NOT bypass the Zod gate (WR-02). Pass `undefined` (not `null`) for absent
  // URLs since the schema is URL-or-empty-or-omitted; a throw aborts the seed.
  const validatedSettings = settingsSchema.parse({
    theme_mode: 'light',
    visitor_theme_toggle: true,
    color_preset: 'default',
    font_preset: 'default',
    page_title: AURORA_DEMO.settings.page_title,
    meta_description: AURORA_DEMO.settings.meta_description,
    email_public: AURORA_DEMO.settings.email_public,
    linkedin_url: AURORA_DEMO.settings.linkedin_url ?? undefined,
    twitter_url: AURORA_DEMO.settings.twitter_url ?? undefined,
    website_url: AURORA_DEMO.settings.website_url ?? undefined,
  });
  const { error: settingsError } = await admin.from('portfolio_settings').upsert(
    {
      portfolio_id: portfolioId,
      theme_mode: validatedSettings.theme_mode,
      visitor_theme_toggle: validatedSettings.visitor_theme_toggle,
      color_preset: validatedSettings.color_preset,
      font_preset: validatedSettings.font_preset,
      page_title: validatedSettings.page_title,
      meta_description: validatedSettings.meta_description,
      email_public: validatedSettings.email_public,
      linkedin_url: validatedSettings.linkedin_url ?? null,
      twitter_url: validatedSettings.twitter_url ?? null,
      website_url: validatedSettings.website_url ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'portfolio_id' },
  );
  if (settingsError) {
    fail(`portfolio_settings upsert failed: ${settingsError.message}`);
  }
  log('portfolio_settings upserted (theme_mode=light, color_preset=default, font_preset=default).');

  // --- 6. Upsert each section (UNIQUE on (portfolio_id, type) → idempotent). --
  // EVERY section's content is validated through the SAME Zod gate the CMS uses
  // (SHARED-C) BEFORE the write; a Zod throw aborts the seed (T-22-seed-02).
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
    log(`section upserted: ${type} (sort_order=${i}, visible=${visible}).`);
  }

  log(
    `SUCCESS: aurora demo portfolio seeded for "${username}" (${userId}) — published, ` +
      `on aurora, ${sections.length} marketer sections. Reachable at /${username}. ` +
      'Re-run any time; upserts are idempotent.',
  );
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
