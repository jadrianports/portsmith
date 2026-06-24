/**
 * scripts/seed-atelier-demo.ts — the idempotent atelier DEMO perf-proof seed
 * (Plan 36-01, D-15 / CTPL-03). Modeled on `scripts/seed-aurora-demo.ts`; only the
 * persona, the template (`atelier` vs `aurora`), and the section set differ.
 *
 * WHAT IT DOES: populates a DEMO portfolio on the gallery-forward `atelier` template
 * (Phase 36) — `profiles` (published) + `portfolios` (on atelier) + `portfolio_settings`
 * + `sections` — carrying a single heavy `gallery` section of ~40 Storage-origin images
 * plus a `hero` (the LCP). This is the CTPL-03 / D-15 PERF-PROOF page: it exercises the
 * top of the 20–50 image range so the Lighthouse mobile ≥ 90 / First-Load-JS budget gate
 * is measured against a realistically heavy gallery, NOT a token one. It is SEPARATE from
 * the conformance golden fixture (Task 2 / D-16) — that fixture proves schema-conformance
 * + masonry wrap with ~6–8 images; THIS seed proves performance at scale.
 *
 * NOT WIRED HERE: the LHCI assertion target for the `/atelier-demo` route is Plan 04's
 * perf task — this plan only produces the seed harness. Actual execution against the local
 * Supabase stack also happens in Plan 04, AFTER the `atelier` template renders (Plan 02)
 * and migration `032_seed_atelier_template.sql` lands its `templates` row. Running this
 * before migration 032 is applied hard-fails at the template lookup (step 3) — by design.
 *
 * IDEMPOTENT: every write is an UPSERT on a natural key (profiles by id, portfolios on
 * user_id with `template_id`=atelier set ON INSERT ONLY, portfolio_settings on
 * portfolio_id, sections on (portfolio_id, type) — the UNIQUE constraints from migration
 * 001), so re-running updates rows in place and never duplicates / accumulates.
 *
 * SERVICE-ROLE (the sanctioned privileged path): like `seed-aurora-demo.ts`, this
 * constructs its OWN standalone admin client with `@supabase/supabase-js`. It DELIBERATELY
 * does NOT import `src/lib/supabase/service-role.ts`, because that module begins with
 * `import 'server-only'`, which THROWS when imported outside a Next.js server bundle (i.e.
 * under `tsx`). The service-role key bypasses RLS AND the protected-columns trigger — the
 * only sanctioned way to set `profiles.published = true`. The key has no NEXT_PUBLIC_
 * prefix and is never bundled; this is a manual, out-of-band tool, NOT runtime app code,
 * imported by no route. The demo user is provisioned by `handle_new_user` as `role:'user'`
 * — this seed never sets `role`.
 *
 * ZOD GATE (SHARED-C / critical rule #1): every section's content is validated through
 * `validateSectionContent(type, content)` — the SAME gate the CMS uses — BEFORE it is
 * written; the profile columns go through `profileSchema.parse`. In particular the gallery
 * items flow through `galleryContentSchema` (each {id,url,width,height,alt}; the CR-01
 * http(s) stored-XSS gate on `url`, required positive-int dims, required non-empty alt), so
 * a malformed image can never be written. A Zod throw aborts the seed.
 *
 * PROD SOFT TRIPWIRE: if NEXT_PUBLIC_SUPABASE_URL is NOT a localhost / 127.0.0.1 URL, the
 * seed REFUSES to write unless an explicit `--confirm-prod` argv flag OR `SEED_TARGET=prod`
 * env is present — so a production write is always intentional, never accidental.
 *
 * CONTENT: this demo's content is generated INLINE (the persona is a placeholder photographer
 * and the ~40 gallery images are programmatic `${STORAGE}`-origin placeholders with varied
 * dimensions) — there is no separate gitignored `scripts/seed/atelier-content.ts`, because
 * the perf seed needs only a hero + a large generated gallery, not hand-authored marketing
 * copy. The exact object paths are placeholders — the perf gate measures the PAYLOAD shape
 * (count × CLS-safe boxes), not the pixels of these specific files.
 *
 * USAGE:
 *   Local:  npx tsx scripts/seed-atelier-demo.ts            (URL is localhost → no flag needed)
 *   Prod:   SEED_TARGET=prod npx tsx scripts/seed-atelier-demo.ts   (or `-- --confirm-prod`)
 */
import { createClient } from '@supabase/supabase-js';
import { profileSchema, validateSectionContent } from '@/lib/validations';

// Load .env.local so the script works without manual `export`s.
// dotenv is a devDependency; ignore if absent (env may already be exported).
try {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
} catch {
  // dotenv not installed / unavailable — rely on the ambient process env.
}

// The only sanctioned image origin: the project's own Supabase Storage public bucket
// (`NEXT_PUBLIC_SUPABASE_URL` origin). The renderer's `isHttpImageSrc` host-guard (D-08
// host-lock, `src/lib/safe-image.ts`) rejects ANY other origin at RENDER time, so every
// seeded `url` MUST be on this exact origin or the gallery filters it out and renders zero
// images — which would make the D-15 ~40-image perf proof vacuous (Plan 04, Rule 1 fix).
// The object PATHS are placeholders (they 404), but each still renders as a CLS-safe
// `next/image unoptimized` box — and D-15 measures the PAYLOAD SHAPE (count × CLS-safe
// boxes + lazy loading), not the pixels of these specific files (see this file's header).
const STORAGE = `${new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
).origin}/storage/v1/object/public`;

// The atelier template UUID (D-13) — pinned in `registry.ts` TEMPLATE_UUIDS and seeded by
// migration `032_seed_atelier_template.sql` (Plan 02). The seed resolves the template by
// SLUG at runtime (below), but we keep the UUID here as the documented pin for clarity.
const ATELIER_TEMPLATE_UUID = '00000000-0000-4000-8000-000000000006';

const DEMO = {
  username: 'atelier-demo',
  bootstrap: {
    email: 'atelier-demo@portsmith.example',
    password: 'atelier-demo-pw-please-change',
  },
  profile: {
    display_name: 'Atelier Demo',
    headline: 'Photographer & visual artist — selected work',
    avatar_url: '',
  },
  settings: {
    page_title: 'Atelier Demo — Selected Work',
    meta_description: 'A heavy gallery-wall demo portfolio for the atelier template perf proof.',
    email_public: 'hello@atelier-demo.example',
  },
} as const;

function fail(message: string): never {
  console.error(`[seed-atelier] ERROR: ${message}`);
  process.exit(1);
}

function log(message: string): void {
  console.log(`[seed-atelier] ${message}`);
}

/** A localhost / loopback Supabase URL → a SAFE (non-prod) target. */
function isLocalTarget(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i.test(url);
}

/**
 * Build the ~40-image gallery content (D-15). Dimensions VARY across a small set of
 * realistic aspect ratios (landscape / portrait / square / panorama / tall) so the
 * masonry packs unevenly at scale and the perf gate measures a realistic heavy wall.
 * Every image carries a `${STORAGE}`-origin http(s) `url`, positive-int `width`/`height`
 * (CLS-safe), and a non-empty `alt` — exactly what `galleryContentSchema` requires.
 */
function buildGalleryContent(): { heading: string; items: unknown[] } {
  const ASPECTS: ReadonlyArray<{ w: number; h: number; shape: string }> = [
    { w: 1600, h: 1067, shape: 'landscape' },
    { w: 1080, h: 1620, shape: 'portrait' },
    { w: 1200, h: 1200, shape: 'square' },
    { w: 2000, h: 900, shape: 'panorama' },
    { w: 900, h: 1350, shape: 'tall portrait' },
    { w: 1500, h: 1000, shape: 'landscape' },
  ];
  const COUNT = 40; // top of the 20–50 range (D-15) — a real heavy gallery can't surprise us.
  const items = Array.from({ length: COUNT }, (_, i) => {
    const n = i + 1;
    const a = ASPECTS[i % ASPECTS.length];
    const id = `gal_${String(n).padStart(2, '0')}`;
    return {
      id,
      url: `${STORAGE}/portfolio-assets/atelier-demo/${id}.webp`,
      width: a.w,
      height: a.h,
      alt: `Selected work plate ${n} — a ${a.shape} photograph from the demo gallery`,
    };
  });
  return { heading: 'Selected Work', items };
}

/**
 * The atelier demo section set: a hero (the LCP / `priority` measurement) + the heavy
 * gallery (the perf payload). `sort_order` is the index; both seeded visible.
 */
function buildSections(): { type: string; content: unknown; visible: boolean }[] {
  const hero = {
    heading: 'Atelier Demo',
    subheading: 'Photographer & visual artist — a heavy gallery-wall perf demo.',
    cta_text: 'See the work',
    cta_url: 'https://atelier-demo.example/#gallery',
    background_image: `${STORAGE}/portfolio-assets/atelier-demo/hero-bg.webp`,
  };
  return [
    { type: 'hero', content: hero, visible: true },
    { type: 'gallery', content: buildGalleryContent(), visible: true },
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

  // --- Prod soft tripwire: a non-localhost target must be confirmed. ---
  const confirmProd =
    process.argv.includes('--confirm-prod') ||
    process.env.SEED_TARGET?.trim().toLowerCase() === 'prod';
  if (!isLocalTarget(supabaseUrl) && !confirmProd) {
    fail(
      `Refusing to seed a NON-LOCAL target (${supabaseUrl}) without explicit ` +
        'confirmation. A production seed must be intentional. Re-run with ' +
        '`SEED_TARGET=prod` (or `-- --confirm-prod`) only if you really mean to ' +
        'write to this database.',
    );
  }
  const targetLabel = isLocalTarget(supabaseUrl) ? 'LOCAL' : 'PROD (confirmed)';
  log(`target: ${targetLabel} — ${supabaseUrl}`);

  // Standalone admin client — bypasses RLS + the protected-columns trigger.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { username } = DEMO;

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
    // FRESH-LOCAL bootstrap (mirrors the aurora/founder seeds): create the auth user so
    // the live `handle_new_user` trigger provisions the profile (as `role:'user'`). The
    // PROD path assumes the demo account was created through the normal flow — so only
    // bootstrap against a LOCAL target.
    if (!isLocalTarget(supabaseUrl)) {
      fail(
        `no profile found for username="${username}" on a non-local target. Create ` +
          'the demo account through the normal signup flow first, then re-run this seed.',
      );
    }
    log(`no profile for "${username}" — bootstrapping a local auth user…`);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: DEMO.bootstrap.email,
      password: DEMO.bootstrap.password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: DEMO.profile.display_name,
      },
    });
    if (createError || !created.user) {
      fail(`bootstrap createUser failed: ${createError?.message ?? 'no user returned'}`);
    }
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
  // The profile columns MUST still pass the SAME Zod gate the CMS uses (`profileSchema`).
  // This seed never sets `role` — the demo user stays `role:'user'`.
  let validatedProfile: ReturnType<typeof profileSchema.parse>;
  try {
    validatedProfile = profileSchema.parse({
      username,
      display_name: DEMO.profile.display_name,
      headline: DEMO.profile.headline,
      avatar_url: DEMO.profile.avatar_url ?? '',
    });
  } catch (err) {
    fail(`profile columns failed the Zod gate: ${err instanceof Error ? err.message : String(err)}`);
  }

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

  // --- 3. Resolve the `atelier` template id (FK target for the portfolio). ----
  // Resolved by SLUG; migration 032 (Plan 02) seeds the row at UUID ATELIER_TEMPLATE_UUID.
  // If the row is missing (032 not yet applied), this hard-fails — by design (this seed is
  // a Plan-04 harness; it cannot run until the template exists).
  const { data: template, error: templateError } = await admin
    .from('templates')
    .select('id, visibility')
    .eq('slug', 'atelier')
    .maybeSingle();
  if (templateError) {
    fail(`templates lookup failed: ${templateError.message}`);
  }
  if (!template) {
    fail(
      'the `atelier` template row is missing. It is seeded by migration ' +
        `032_seed_atelier_template.sql (UUID ${ATELIER_TEMPLATE_UUID}, Plan 36-02) — ` +
        'apply migrations forward (`npx supabase migration up`) and re-run.',
    );
  }
  log(`atelier template resolved: ${template.id} (visibility=${template.visibility}).`);

  // --- 4. Ensure the portfolio (UNIQUE on user_id → idempotent). --------------
  // Set `template_id = atelier` ONLY when CREATING the portfolio; when it already exists
  // we DO NOT touch `template_id` (never clobber a live choice on re-run).
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
    const { error: portfolioUpdateError } = await admin
      .from('portfolios')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', existingPortfolio.id);
    if (portfolioUpdateError) {
      fail(`portfolios update failed: ${portfolioUpdateError.message}`);
    }
    portfolioId = existingPortfolio.id;
    log(`portfolio refreshed: ${portfolioId} (template_id preserved: ${existingPortfolio.template_id}).`);
  } else {
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
    log(`portfolio created: ${portfolioId} (template_id=atelier).`);
  }

  // --- 4b. Self-healing demo-user→atelier grant (only if restricted). ---------
  // atelier ships visibility `'public'` (D-10) — so NO grant row is needed. We mirror the
  // aurora seed's discipline: upsert a grant ONLY if the template is restricted, so the
  // demo stays robust if atelier is ever soaked as restricted. `ignoreDuplicates` makes a
  // re-run a clean no-op.
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
      fail(`demo-user→atelier template_grants upsert failed: ${grantError.message}`);
    }
    log('demo-user→atelier template_grants upserted (atelier is restricted; self-healing).');
  } else {
    log(`atelier is ${template.visibility} (not restricted) — no template_grants row needed.`);
  }

  // --- 5. Upsert portfolio_settings (UNIQUE on portfolio_id → idempotent). ----
  // The atelier template follows the export's light/dark default (D-05). The DB column
  // DEFAULTS to 'dark'; we leave theme_mode unset on the upsert payload so the column
  // default applies on INSERT and is preserved on re-run. Presets are `'default'`.
  const { error: settingsError } = await admin.from('portfolio_settings').upsert(
    {
      portfolio_id: portfolioId,
      visitor_theme_toggle: true,
      color_preset: 'default',
      font_preset: 'default',
      page_title: DEMO.settings.page_title,
      meta_description: DEMO.settings.meta_description,
      email_public: DEMO.settings.email_public,
      socials: [],
      location: null,
      phone: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'portfolio_id' },
  );
  if (settingsError) {
    fail(`portfolio_settings upsert failed: ${settingsError.message}`);
  }
  log('portfolio_settings upserted (color_preset=default, font_preset=default).');

  // --- 6. Upsert each section (UNIQUE on (portfolio_id, type) → idempotent). --
  // EVERY section's content is validated through the SAME Zod gate the CMS uses (SHARED-C)
  // BEFORE the write — the ~40 gallery items flow through `galleryContentSchema`. A Zod
  // throw aborts the seed.
  const sections = buildSections();
  for (let i = 0; i < sections.length; i++) {
    const { type, content, visible } = sections[i];
    let validated: unknown;
    try {
      validated = validateSectionContent(type, content);
    } catch (err) {
      fail(`section "${type}" failed the Zod gate: ${err instanceof Error ? err.message : String(err)}`);
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
    `SUCCESS: atelier demo portfolio seeded for "${username}" (${userId}) — published, ` +
      `on atelier, ~40-image gallery + hero. Reachable at /${username}. ` +
      'Re-run any time; upserts are idempotent.',
  );
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
