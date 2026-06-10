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
import { profileSchema, validateSectionContent, postContentSchema } from '@/lib/validations';
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
  // OPTION A (03-08): surface the intended-public contact email INTO the contact
  // section content as the additive, OPTIONAL `email_public` field so the Contact
  // section can render a `mailto:` fallback under the FROZEN `{ section }`
  // SectionProps contract (the section never receives `data.settings`). The source
  // of truth stays `settings.email_public`; we copy it here (the same idiom the
  // hero uses for `resume_url`). This is additive JSONB content — no migration
  // (CMS-08) — and is validated by the SAME Zod gate (`contactContentSchema` now
  // carries the optional `email_public`).
  const contactContent = {
    ...s.contact,
    email_public: FOUNDER.settings.email_public,
  };
  // WR-01 (03-REVIEW): surface profile.resume_url INTO the hero content so the
  // "Download résumé" button (D-14) actually renders. `heroContentSchema` now carries
  // an OPTIONAL `resume_url`, so the field survives the Zod gate (without the schema
  // field it would be stripped — the dead-button bug). Same additive idiom the
  // contact section uses for `email_public`; no Postgres migration (CMS-08). The
  // value is empty-allowed/http(s)-validated by the gate, so a placeholder run with
  // no résumé simply keeps the button hidden.
  const heroContent = {
    ...s.hero,
    resume_url: FOUNDER.profile.resume_url,
  };
  return [
    { type: 'hero', content: heroContent, visible: true },
    { type: 'about', content: s.about, visible: true },
    // PIPE-09 / 13-05 (D-10 seed-first): the founder's `metrics` "by the numbers" block.
    // edgerunner's spec supports `metrics` (the export's `profile.stats` → the metrics
    // soft-enum type, 11-04 Step C1); minimal/editorial don't render it but the content
    // round-trips losslessly across a switch (the section is hidden where unsupported, the
    // data is preserved). Gated by the SAME validateSectionContent (`metricsContentSchema`).
    { type: 'metrics', content: s.metrics, visible: true },
    { type: 'skills', content: s.skills, visible: true },
    { type: 'projects', content: s.projects, visible: true },
    { type: 'experience', content: s.experience, visible: true },
    // D-06: Testimonials is BUILT but seeded HIDDEN until ≥2 real quotes exist.
    {
      type: 'testimonials',
      content: { heading: 'Testimonials', items: [] },
      visible: false,
    },
    // Services — after skills/projects, before blog_preview; sort_order follows testimonials.
    // `validateSectionContent('services', ...)` runs below (the SAME Zod gate as the CMS).
    { type: 'services', content: s.services, visible: true },
    // blog_preview — TRANSMISSIONS blog teaser section (edgerunner-v2, data-driven cards).
    // Additive — no migration; `blog_preview` is a registered soft-enum type (CMS-08).
    { type: 'blog_preview', content: s.blog_preview, visible: true },
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
  // WR-04 (03-REVIEW): the service-role write bypasses RLS + the protected-columns
  // trigger, so the profile columns it sets must STILL pass the SAME Zod gate the
  // Phase-4 profile-edit form will use. In particular `resume_url` / `avatar_url`
  // are now http(s)-validated (`profileSchema`) so the seed can never write a
  // dangerous-scheme URL that would later flow into an `href` / `<Image src>`. A Zod
  // throw aborts the seed before any write.
  let validatedProfile: ReturnType<typeof profileSchema.parse>;
  try {
    validatedProfile = profileSchema.parse({
      username,
      display_name: FOUNDER.profile.display_name,
      headline: FOUNDER.profile.headline,
      resume_url: FOUNDER.profile.resume_url,
      avatar_url: FOUNDER.profile.avatar_url ?? '',
    });
  } catch (err) {
    fail(
      `profile columns failed the Zod gate (WR-04): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // `published: true` is the sanctioned service-role write (Plan 01-09).
  const profileUpdate: Record<string, unknown> = {
    display_name: validatedProfile.display_name,
    headline: validatedProfile.headline,
    resume_url: validatedProfile.resume_url,
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

  // --- 4. Ensure the portfolio (UNIQUE on user_id → idempotent). --------------
  // PRESERVE THE LIVE TEMPLATE CHOICE (13-05 fix, T-13-05-SPILL): a blind UPSERT that
  // always SET `template_id = minimal` would REVERT the owner's chosen template every
  // re-run — including the founder→edgerunner switch the 015 migration makes (and any
  // future template the owner picks in the CMS). So we set `template_id = minimal` ONLY
  // when CREATING the portfolio (the fresh-DB bootstrap default — D-P7-09: new portfolios
  // start on a standard template); when the portfolio already exists we DO NOT touch
  // `template_id`, leaving the migration's / owner's choice intact. `template_id` is NOT
  // NULL, so it must be supplied on the initial INSERT.
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
    // Exists — refresh only `updated_at`; never clobber the live `template_id` (13-05).
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
    // Fresh DB — create on the minimal bootstrap default (the 015 migration, or the owner
    // via the CMS, switches it afterward).
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
    log(`portfolio created: ${portfolioId} (bootstrap template_id=minimal).`);
  }

  // --- 4b. Self-healing founder→minimal grant (D-P12-04 / OQ-1). --------------
  // Template gating (Phase 12) makes `minimal` a RESTRICTED template; without a
  // grant the founder would be ungranted-restricted on his OWN template and the
  // GATE-03 switch gate would reject re-selecting it. Migration 013 seeds this
  // grant by deriving the founder FROM the data (the portfolio on the minimal
  // UUID) — but on a FRESH DB, if THIS seed script runs AFTER 013, no portfolio is
  // on minimal at migration time and 013's INSERT…SELECT matches zero rows (OQ-1).
  // So we ALSO upsert the grant here, order-independently, using the script's
  // EXISTING service-role admin client + the already-resolved founder id +
  // `template.id` (the minimal template id). This is the ONE place a grant write
  // legitimately uses the service-role client — it is a build/seed script, not a
  // request path, consistent with every other write above (the request-path grant
  // writes go through authenticated admin-RLS, 12-05). `onConflict` on the
  // composite PK with `ignoreDuplicates` makes a re-run (or a 013-already-ran DB)
  // a clean no-op.
  const { error: grantError } = await admin.from('template_grants').upsert(
    {
      template_id: template.id,
      user_id: userId,
      granted_by: null,
    },
    { onConflict: 'template_id,user_id', ignoreDuplicates: true },
  );
  if (grantError) {
    fail(`founder→minimal template_grants upsert failed: ${grantError.message}`);
  }
  log('founder→minimal template_grants upserted (self-healing, D-P12-04/OQ-1).');

  // --- 4c. Self-healing founder→edgerunner grant (PIPE-09 / 13-05, T-13-05-ORDER). ---
  // Phase 13 makes `edgerunner` the founder's RESTRICTED/exclusive live template. The 015
  // migration grants it by deriving the founder FROM the data (the portfolio on the minimal
  // UUID, BEFORE it switches that portfolio to edgerunner — the grant-then-switch order). But
  // on a FRESH DB, if THIS seed script runs AFTER 015, no portfolio is on minimal at migration
  // time → 015's INSERT…SELECT matches zero rows → the founder is ungranted-restricted on his
  // OWN live template and GATE-03 would auto-fallback him to editorial. So we ALSO upsert the
  // edgerunner grant here, order-independently — the SAME belt-and-suspenders idiom as the
  // founder→minimal grant above (4b / OQ-1). We resolve the edgerunner template id by slug
  // (mirroring the minimal lookup at step 3); if the row is absent (015 not yet applied) we
  // skip silently — the migration's Step 2 will create the grant when it runs. `onConflict` on
  // the composite PK with `ignoreDuplicates` makes a re-run (or a 015-already-ran DB) a no-op.
  const { data: edgerunnerTemplate, error: edgerunnerLookupError } = await admin
    .from('templates')
    .select('id')
    .eq('slug', 'edgerunner')
    .maybeSingle();
  if (edgerunnerLookupError) {
    fail(`edgerunner template lookup failed: ${edgerunnerLookupError.message}`);
  }
  if (edgerunnerTemplate) {
    const { error: edgerunnerGrantError } = await admin.from('template_grants').upsert(
      {
        template_id: edgerunnerTemplate.id,
        user_id: userId,
        granted_by: null,
      },
      { onConflict: 'template_id,user_id', ignoreDuplicates: true },
    );
    if (edgerunnerGrantError) {
      fail(`founder→edgerunner template_grants upsert failed: ${edgerunnerGrantError.message}`);
    }
    log('founder→edgerunner template_grants upserted (self-healing, PIPE-09/T-13-05-ORDER).');
  } else {
    log('edgerunner template row not present yet — skipping founder→edgerunner grant (migration 015 will create it).');
  }

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

  // --- 7. Upsert each blog post (UPSERT on (portfolio_id, slug) → idempotent). --
  // 13.2-07 DOGFOOD (D-17 / SC-3): the founder's posts become REAL `blog_posts`
  // rows through the SAME Markdown write gate the CMS uses — `postContentSchema`
  // (SHARED-C). Each body is validated BEFORE the service-role upsert; a Zod throw
  // aborts the seed (T-13.2-19 — the seed never bypasses the gate). The upsert key
  // is the `(portfolio_id, slug)` natural key (the uq_blog_posts_portfolio_slug
  // UNIQUE from migration 001), so a re-run UPDATEs in place and never duplicates.
  // `published_at` is set from `display_date` (D-05) the first time and refreshed on
  // re-run; `published: true` makes the post live (the public_blog_posts view + the
  // blog_post_is_public DEFINER helper gate visibility). This is the sanctioned
  // service-role seed write — like the sections above, it does NOT import
  // `service-role.ts` (that module's `import 'server-only'` throws under tsx).
  for (const post of FOUNDER.posts) {
    let validatedPost: ReturnType<typeof postContentSchema.parse>;
    try {
      validatedPost = postContentSchema.parse(post);
    } catch (err) {
      fail(
        `blog post "${post.slug}" failed the Zod gate (postContentSchema): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    // `published_at` (a TIMESTAMPTZ) — derive from the editable D-05 `display_date`
    // (a DATE) so the published timestamp matches the post's real date; fall back to
    // now() when no display_date is given.
    const publishedAt = validatedPost.display_date
      ? new Date(`${validatedPost.display_date}T00:00:00.000Z`).toISOString()
      : new Date().toISOString();
    const { error: postError } = await admin.from('blog_posts').upsert(
      {
        portfolio_id: portfolioId,
        title: validatedPost.title,
        slug: validatedPost.slug,
        body_md: validatedPost.body_md,
        excerpt: validatedPost.excerpt ?? null,
        display_date: validatedPost.display_date ?? null,
        tags: validatedPost.tags ?? [],
        published: validatedPost.published ?? false,
        published_at: validatedPost.published ? publishedAt : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'portfolio_id,slug' },
    );
    if (postError) {
      fail(`blog post "${post.slug}" upsert failed: ${postError.message}`);
    }
    log(
      `blog post upserted: ${validatedPost.slug} (published=${
        validatedPost.published ?? false
      }, display_date=${validatedPost.display_date ?? 'none'}).`,
    );
  }

  log(
    `SUCCESS: founder portfolio seeded for "${username}" (${userId}) — published, ` +
      `dark+toggle, Testimonials hidden, ${FOUNDER.posts.length} blog posts. Re-run any ` +
      'time; upserts are idempotent.',
  );
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
