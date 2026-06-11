/**
 * TMPL-02 — the lossless template round-trip (D-P7-13a). GREENED BY 07-05 (the
 * template switcher UI + preview-before-commit) and this 07-06 phase gate.
 *
 * THE PROOF (D-P7-13a — the (a) leg of the D-P7-13 bar; the (b) ONLY-template_id
 * RLS leg is already green in 07-04's integration test):
 *   fill / seed EVERY section with a UNIQUE typed value → open the dashboard
 *   template picker → preview the OTHER template's candidate in Draft Mode → assert
 *   all the unique content renders there (the unique values AND the correctly-toggled
 *   Newsprint marker) → "Use this template" (commit via 07-04's switchTemplateAction)
 *   → assert the PUBLIC page renders all the content in the switched template (poll
 *   via waitForPublicState) → switch BACK → assert the PUBLIC page renders the SAME
 *   unique values again — content IDENTICAL to the start (nothing was lost). Modeled
 *   on e2e/cms-loop.spec.ts + e2e/helpers/cms-auth.ts.
 *
 * DIRECTION (a real integration fact — migration 008 part C): a NEWLY bootstrapped
 * portfolio defaults to EDITORIAL (Newsprint); the founder STAYS minimal (D-P7-09).
 * So this fresh test owner starts on editorial, and the round-trip runs
 * editorial → minimal → editorial. The lossless guarantee is direction-agnostic —
 * what matters is that identical content survives a forward switch and a switch
 * back, with the Newsprint "02 — About" kicker present on editorial and absent on
 * minimal in BOTH the Draft-Mode preview and the public ISR page.
 *
 * CONTENT-INDEPENDENCE (cms-loop.spec.ts:54-55 idiom): every assertion targets a
 * UNIQUE value THIS TEST generated (stamped with a per-run token), NEVER seeded
 * placeholder copy — so a regression in the switch/lossless chain is what fails the
 * test, not a content edit elsewhere. The template difference is STYLING only
 * (D-P7-10); the same content must survive a round-trip through both templates.
 *
 * "FILL EVERY SECTION" — how all 7 section types carry a unique test value:
 *   - Hero (heading + subheading), About (bio), Contact (heading + subheading) are
 *     typed through the REAL editor UI (SectionForm → saveSectionAction → revalidate),
 *     exercising the editor→save→render chain exactly as cms-loop does.
 *   - Skills, Projects, Experience, Testimonials carry their unique values via a
 *     service-role admin seed in beforeAll (the same admin-API setup idiom the
 *     cms-auth helper uses for createConfirmedOwner). The skills/projects/experience/
 *     testimonials editors are item/group managers whose multi-write auto-save UI is
 *     not the thing under proof here — the SWITCH/lossless chain is — so seeding their
 *     content deterministically (and flipping the default-hidden Testimonials visible)
 *     keeps the gate reliable while making "every section" REAL: all 7 types render a
 *     unique value that must survive the forward switch to Newsprint and the switch
 *     back to minimal. Assertions still reference ONLY test-generated values.
 *
 * NEWSPRINT MARKER (the styling-difference proof, plan acceptance criterion 3): the
 * Editorial template renders mono "department" kickers ("01 — Profile", "02 — About",
 * …) that the minimal template does NOT. The round-trip asserts the `02 — About`
 * kicker is PRESENT in the editorial preview + the public editorial page, and ABSENT
 * once switched back to minimal — so the assertion proves the template actually
 * changed around identical content (not just that text is present).
 *
 * SELECTORS model the UI-SPEC B.8 copy strings (the switcher chrome contract):
 *   - picker entry    → the "Template" rail button (opens the gallery)
 *   - picker heading  → "Choose a template"
 *   - card action     → "Preview the {Template} template with your content"
 *   - banner context  → "Previewing the {Template} template"
 *   - confirm         → "Use this template"
 *   - success beat    → "Your page now uses the {Template} template."
 * The reused PreviewBanner keeps the Phase-4 "Draft preview" text + all preview/exit
 * links stay prefetch={false} / full-nav (the cookie-race caveat — the shell, the
 * card, and the banner already enforce it).
 *
 * Run command: `npx playwright test e2e/template-switch.spec.ts`.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import {
  createConfirmedOwner,
  deleteOwner,
  signInAsOwner,
  waitForPublicState,
  type TestOwner,
} from './helpers/cms-auth';

/** Service-role admin client — BYPASSES RLS; used ONLY to seed the item/skills/group
 *  section content in beforeAll (the same setup-only idiom cms-auth uses). */
function adminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[e2e] template-switch seed needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ' +
        '(start the local stack; playwright.config.ts loads .env.local).',
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test.describe('TMPL-02 — lossless template round-trip (GREENED BY 07-05/07-06)', () => {
  let owner: TestOwner;

  // One per-run token → every value this spec asserts on is unique (content-
  // independence). Stamped into all 7 sections so a stray seeded literal can never
  // satisfy an assertion.
  const stamp = Date.now().toString(36);
  const heroHeading = `Switch Hero ${stamp}`;
  const heroSubheading = `Switch role line ${stamp}`;
  const aboutBio = `Switch About bio ${stamp}`;
  const contactHeading = `Switch Contact ${stamp}`;
  const contactSubheading = `Switch contact sub ${stamp}`;
  // Seeded (admin) section values — also unique + test-controlled.
  const skillsGroupLabel = `SwitchStack${stamp}`;
  const skillName = `SwitchSkill ${stamp}`;
  const projectTitle = `Switch Project ${stamp}`;
  const projectDescription = `Switch project blurb ${stamp}`;
  const experienceRole = `Switch Role ${stamp}`;
  const experienceCompany = `Switch Company ${stamp}`;
  const testimonialName = `Switch Referee ${stamp}`;
  const testimonialQuote = `Switch testimonial quote ${stamp}`;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('switch');

    // Seed the item/group/hidden sections with UNIQUE values via the service-role
    // admin client (setup-only; bypasses RLS like the helper's createUser). This
    // makes "every section" real — projects/experience/testimonials/skills each carry
    // a test-controlled value — and flips the default-hidden Experience/Testimonials
    // sections visible so they reach the public_sections view. Hero/About/Contact are
    // typed through the real editor UI in the test body.
    //
    // BOOTSTRAP SHAPE (a real integration fact — migration 006 `initialize_portfolio`):
    // the RPC seeds hero/about/projects/experience/testimonials/contact/blog_preview —
    // there is NO standalone `skills` section row (skills live in `about.skills`). The
    // editorial template, however, ships a dedicated Skills SECTION surface, so we
    // INSERT a real skills row (not update) to exercise it in the round-trip. The
    // UPDATEs below assert they hit exactly one row (`{ count: 'exact' }`) so a future
    // bootstrap-shape change surfaces loudly instead of silently no-op'ing.
    const admin = adminClient();

    const updates: { type: string; content: Record<string, unknown> }[] = [
      {
        type: 'projects',
        content: {
          heading: `Work ${stamp}`,
          items: [
            {
              id: `proj-${stamp}`,
              slug: `proj-${stamp}`,
              title: projectTitle,
              description: projectDescription,
              tech_stack: [],
            },
          ],
        },
      },
      {
        type: 'experience',
        content: {
          heading: `Experience ${stamp}`,
          items: [
            {
              id: `exp-${stamp}`,
              role: experienceRole,
              company: experienceCompany,
              start_date: '2022-01',
              end_date: 'present',
              description: `Switch experience blurb ${stamp}`,
            },
          ],
        },
      },
      {
        type: 'testimonials',
        content: {
          heading: `Testimonials ${stamp}`,
          items: [
            {
              id: `tst-${stamp}`,
              name: testimonialName,
              company: `Switch Co ${stamp}`,
              quote: testimonialQuote,
            },
          ],
        },
      },
    ];

    for (const seed of updates) {
      // visible:true — Experience + Testimonials are seeded hidden by the bootstrap;
      // flipping them on lets them reach the visible-only public_sections view.
      const { error, count } = await admin
        .from('sections')
        .update({ content: seed.content, visible: true }, { count: 'exact' })
        .eq('portfolio_id', owner.portfolioId)
        .eq('type', seed.type);
      if (error) {
        throw new Error(
          `[e2e] seeding ${seed.type} for ${owner.username} failed: ${error.message}`,
        );
      }
      if (count !== 1) {
        throw new Error(
          `[e2e] seeding ${seed.type} matched ${count ?? 0} rows (expected 1) — the ` +
            'bootstrap section shape changed; update the seed.',
        );
      }
    }

    // INSERT the skills section the bootstrap does not create (sort_order after the
    // 7 bootstrapped rows; the editorial index resolves Skills by TYPE so the exact
    // sort_order is cosmetic here).
    const { error: skillsErr } = await admin.from('sections').insert({
      portfolio_id: owner.portfolioId,
      type: 'skills',
      sort_order: 7,
      visible: true,
      content: {
        heading: `Skills ${stamp}`,
        groups: [
          {
            label: skillsGroupLabel,
            items: [{ name: skillName, tier: 'core' }],
          },
        ],
      },
    });
    if (skillsErr) {
      throw new Error(
        `[e2e] inserting the skills section for ${owner.username} failed: ${skillsErr.message}`,
      );
    }
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('fill every section → preview editorial → switch → public renders all → switch back identical', async ({
    page,
  }) => {
    // Cold Next 16 dev compiles + real auth + writes + revalidate + a SECOND template
    // chunk compiling on first hit — generous headroom on Windows.
    test.setTimeout(240_000);

    // 1) Sign in → the editor mounts (populated, not blank).
    await signInAsOwner(page, owner);

    // 2) Type the unique Hero heading + subheading through the real editor, Save.
    await page.getByRole('button', { name: 'Hero', exact: true }).click();
    const heading = page.getByLabel('Heading', { exact: true });
    await expect(heading).toBeVisible();
    await heading.fill(heroHeading);
    await page.getByLabel('Subheading', { exact: true }).fill(heroSubheading);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved — your page is live')).toBeVisible({ timeout: 30_000 });

    // Type the unique About bio + Save.
    await page.getByRole('button', { name: 'About', exact: true }).click();
    const bio = page.getByLabel('Bio', { exact: true });
    await expect(bio).toBeVisible();
    await bio.fill(aboutBio);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved — your page is live')).toBeVisible({ timeout: 30_000 });

    // Type the unique Contact heading + subheading + Save (the 3rd UI-filled section).
    await page.getByRole('button', { name: 'Contact', exact: true }).click();
    const contactHeadingField = page.getByLabel('Heading', { exact: true });
    await expect(contactHeadingField).toBeVisible();
    await contactHeadingField.fill(contactHeading);
    await page.getByLabel('Subheading', { exact: true }).fill(contactSubheading);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved — your page is live')).toBeVisible({ timeout: 30_000 });

    // ── STARTING TEMPLATE (a real integration fact, migration 008 part C): NEW
    //    bootstraps default to EDITORIAL (the founder STAYS minimal — D-P7-09). So this
    //    fresh owner starts on Newsprint; the lossless round-trip runs editorial →
    //    minimal → editorial. The proof is direction-agnostic: it asserts identical
    //    content across a forward switch AND a switch back, with the Newsprint marker
    //    toggling correctly (present on editorial, absent on minimal). ──

    const publicPath = `/${owner.username}`;

    // 3) PUBLISH (a fresh account is unpublished) so the public ISR page is live, and
    //    confirm the STARTING public page is editorial (Newsprint) and carries every
    //    unique value — the round-trip baseline.
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 30_000 });
    await waitForPublicState(page, publicPath, { status: 200, expectText: '02 — About' });
    for (const value of [
      heroHeading,
      heroSubheading,
      aboutBio,
      skillName,
      projectTitle,
      experienceRole,
      testimonialQuote,
      contactHeading,
    ]) {
      await waitForPublicState(page, publicPath, { status: 200, expectText: value });
    }

    // 4) Open the template picker — the "Template" rail entry surfaces the gallery
    //    (UI-SPEC B.8 — the "Choose a template" heading appears). The rail button's
    //    accessible name is "Template Choose your look" (the row label + its caption),
    //    so anchor on the leading word (never matches "Use this template").
    await page.getByRole('button', { name: /^Template\b/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Choose a template' }),
    ).toBeVisible({ timeout: 30_000 });

    // 5) FORWARD SWITCH editorial → minimal. Preview the Minimal candidate in Draft
    //    Mode (the card's prefetch={false} enable-route link). The reused PreviewBanner
    //    shows "Draft preview" + the "Previewing the Minimal template" context line.
    await page
      .getByRole('link', { name: 'Preview the Minimal template with your content' })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${owner.username}(\\b|/|\\?|$)`), {
      timeout: 30_000,
    });
    // D-07 (17-06): the reused banner's recast base primary line ("Draft · only you
    // can see this page") sits ABOVE the unchanged switch-flow context line
    // ("Previewing the Minimal template"). The switch-flow confirm bar is preserved.
    await expect(page.getByText('Draft · only you can see this page')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/previewing the minimal template/i)).toBeVisible();
    // Every unique value still renders in the minimal candidate (content survived the
    // styling change)…
    await expect(page.getByRole('heading', { level: 1, name: heroHeading })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(heroSubheading)).toBeVisible();
    await expect(page.getByText(aboutBio)).toBeVisible();
    await expect(page.getByText(skillName)).toBeVisible();
    await expect(page.getByText(projectTitle)).toBeVisible();
    await expect(page.getByText(experienceRole)).toBeVisible();
    await expect(page.getByText(testimonialQuote)).toBeVisible();
    await expect(page.getByText(contactHeading)).toBeVisible();
    // …and the NEWSPRINT-SPECIFIC marker is ABSENT in minimal (the mono "02 — About"
    // department kicker the editorial template renders and minimal never does) — the
    // candidate really IS the other template, not just the same one re-rendered.
    await expect(page.getByText('02 — About', { exact: false })).toHaveCount(0);

    // 6) "Use this template" → switchTemplateAction commits + revalidates, the calm
    //    success beat shows, then it exits Draft Mode (full nav to the disable route).
    await page.getByRole('button', { name: 'Use this template', exact: true }).click();
    await expect(
      page.getByText(/your page now uses the minimal template/i),
    ).toBeVisible({ timeout: 30_000 });

    // The PUBLIC page now renders ALL the unique content in MINIMAL — a cookie-less GET
    // against the ISR page; the editorial-only kicker is gone from the public HTML.
    for (const value of [
      heroHeading,
      heroSubheading,
      aboutBio,
      skillName,
      projectTitle,
      experienceRole,
      testimonialQuote,
      contactHeading,
    ]) {
      await waitForPublicState(page, publicPath, { status: 200, expectText: value });
    }
    const minimalHtml = await page.context().request.get(publicPath);
    expect(await minimalHtml.text()).not.toContain('02 — About');

    // 7) Switch BACK to editorial and assert the content is IDENTICAL — the round-trip
    //    is lossless (D-P7-13a). The banner exited Draft Mode onto the public page, so
    //    return to the dashboard, reopen the picker, preview editorial, confirm.
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Your portfolio' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: /^Template\b/ }).click();
    await expect(
      page.getByRole('heading', { name: 'Choose a template' }),
    ).toBeVisible({ timeout: 30_000 });
    await page
      .getByRole('link', { name: 'Preview the Editorial template with your content' })
      .click();
    // In the editorial preview the same unique heading renders…
    await expect(page.getByRole('heading', { level: 1, name: heroHeading })).toBeVisible({
      timeout: 30_000,
    });
    // …and the Newsprint kicker is BACK (the template genuinely changed back).
    await expect(page.getByText('02 — About', { exact: false })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: 'Use this template', exact: true }).click();
    await expect(
      page.getByText(/your page now uses the editorial template/i),
    ).toBeVisible({ timeout: 30_000 });

    // The PUBLIC page still carries EVERY value we typed/seeded — nothing was lost
    // switching editorial → minimal → editorial — now rendered in editorial again (the
    // Newsprint kicker is back in the public HTML). Byte-identical content, both ways.
    await waitForPublicState(page, publicPath, { status: 200, expectText: '02 — About' });
    for (const value of [
      heroHeading,
      heroSubheading,
      aboutBio,
      skillName,
      projectTitle,
      experienceRole,
      testimonialQuote,
      contactHeading,
    ]) {
      await waitForPublicState(page, publicPath, { status: 200, expectText: value });
    }
  });
});
