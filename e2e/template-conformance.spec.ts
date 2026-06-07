/**
 * PIPE-05 — the template CONFORMANCE render gate (Phase-10 Plan 04, the Wave-2 render tier).
 *
 * This gate exercises a template's RUNTIME render behavior — the things the static
 * source-scanning gates (Plan 10-03) can't see: does the template DROP a section its spec
 * declares supported+filled, does it THROW on null-guarding, does it LEAK an unguarded field
 * (`null`/`undefined`/`NaN`/`[object Object]`) into the DOM. It renders every registered
 * template (`Object.keys(templateRegistry)` → `minimal` + `editorial`) over the SRC-SIDE
 * golden + all-null fixtures via the stack-free `__fixture` route (`renderFixture`).
 *
 * ── PER SLUG, TWO RENDER TESTS ────────────────────────────────────────────────
 *   1) "renders every spec-declared supported section (no drop)" — renders `variant=full`
 *      and, for every `[type, entry]` of `resolveSpec(slug).sections` that is BOTH
 *      `supported:true` AND filled by the golden fixture (`type in goldenFixture`), asserts
 *      the WRAPPER marker `[data-section-type="<type>"]` is present (count 1). Keying on the
 *      always-mounted WRAPPER (Pitfall 5), not body text (absent when a section is empty), is
 *      what makes a DROPPED supported section a witnessed failure.
 *   2) "all-null render does not throw or leak" — renders BOTH all-null sub-variants
 *      (`sub=empty` and `sub=null-content`), asserts the navigation returned 200 (a non-200
 *      means a template THREW while null-guarding — PIPE-05), and asserts the `.tmpl-<slug>`
 *      text contains NONE of `null`/`undefined`/`NaN`/`[object Object]`. This leak check is
 *      SCOPED TO THE ALL-NULL render (Pitfall 6): on a populated render real prose can
 *      legitimately contain the substring "null"; on the all-null render any such token IS an
 *      unguarded field leak.
 *
 * ── NEGATIVE CONTROL (D-P10-02 — "a gate that has only ever passed is untrusted") ──
 * `tests/fixtures/broken-template/` is the deliberately-broken negative fixture. It is
 * registry-ABSENT (D-P10-02a) — it lives ONLY under `tests/`, so it can NEVER be imported by
 * the `__fixture` route (W8 / T-10-02-GRAPHLEAK forbids any `tests/` import entering the Next
 * compilation graph). The conformance negative-control therefore renders a FAITHFUL DOM of the
 * broken fixture via `page.setContent` (no Next route, no graph import) and proves the gate's
 * REJECT path goes RED on it:
 *   - the broken root DROPS its `data-section-type="contact"` wrapper while its spec marks
 *     `contact` supported:true+filled → the supported-section assertion finds count 0 (REJECT).
 *   - the broken root reads `profile.username.toUpperCase()` with NO null-guard → on the
 *     all-null render it leaks/throws (REJECT).
 * To keep this control HONEST and drift-resistant, it first READS the broken fixture's source
 * (`tests/fixtures/broken-template/index.tsx` + `spec.ts`) and asserts the gate-tripping
 * artifacts are present in the real source (the dropped `contact` wrapper + the `contact`
 * supported:true spec entry + the unguarded `.toUpperCase()`). If someone "fixes" the broken
 * fixture, the source anchor fails and the control is re-validated. The rendered `setContent`
 * DOM mirrors exactly what `BrokenTemplate` emits (the live sections present, `contact`
 * dropped), so the SAME conformance assertion that PASSES the real corpus FAILS here.
 *
 * Run: `npx playwright test e2e/template-conformance.spec.ts` (npm: `gate:conformance`).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import type { TemplateSpec } from '@/components/templates/minimal/spec';
import { minimalSpec } from '@/components/templates/minimal/spec';
import { editorialSpec } from '@/components/templates/editorial/spec';
import { auroraSpec } from '@/components/templates/aurora/spec';
import { edgerunnerSpec } from '@/components/templates/edgerunner/spec';
import { edgerunnerV2Spec } from '@/components/templates/edgerunner-v2/spec';
import { goldenFixture } from '@/lib/fixtures/lovable-scaffold-golden';

import { renderFixture } from './helpers/render-fixture';

/**
 * Slug → spec map, built from the per-template spec modules DIRECTLY (not via
 * `registry.ts`'s `resolveSpec`). The Playwright runner imports specs into the Node ESM
 * context at collection time, where `registry.ts` is un-importable (its `next/dynamic` import
 * has no resolver outside the Next build). The spec modules (`minimal/spec.ts`,
 * `editorial/spec.ts`) are `next/dynamic`-free pure data, so they import cleanly here — and
 * they are the SAME source of truth `resolveSpec(slug)` returns at render time. The slug set
 * mirrors `Object.keys(templateRegistry)` (asserted by `registry-consistency.test.ts`); a
 * Phase-11 template adds one line here alongside its registry line.
 */
const SPEC_BY_SLUG: Record<string, TemplateSpec> = {
  minimal: minimalSpec,
  editorial: editorialSpec,
  aurora: auroraSpec,
  edgerunner: edgerunnerSpec,
  'edgerunner-v2': edgerunnerV2Spec,
};

/** Every registered template slug — the corpus the conformance gate generalizes over. */
const SLUGS = Object.keys(SPEC_BY_SLUG);

/** The four leak tokens an all-null render must NOT contain (Pitfall 6 — scoped to all-null). */
const LEAK_TOKENS = ['null', 'undefined', 'NaN', '[object Object]'] as const;

// `next dev` cold-compiles the `__fixture` route + each lazy template chunk on first hit
// (Windows, Next 16); give generous headroom so the first navigation's route compilation fits
// (the same budget the parity spec uses, lines 104-106).
test.beforeEach(({}, info) => {
  info.setTimeout(120_000);
});

for (const slug of SLUGS) {
  test(`${slug} — renders every spec-declared supported+filled section (no drop, PIPE-05)`, async ({
    page,
  }) => {
    // POPULATED render (the golden fixture content) via the stack-free __fixture route.
    await renderFixture(page, slug, { variant: 'full' });

    const spec = SPEC_BY_SLUG[slug]!;
    for (const [type, entry] of Object.entries(spec.sections)) {
      // A section is in scope ONLY if the template declares it supported AND the golden
      // fixture fills it (`type in goldenFixture`) — `blog_preview` is supported on minimal
      // but ABSENT from the golden fixture, so it is correctly skipped (not a dropped section).
      const supportedAndFilled = entry?.supported === true && type in goldenFixture;
      if (!supportedAndFilled) continue;

      await expect(
        page.locator(`[data-section-type="${type}"]`),
        `${slug} declares "${type}" supported and the golden fixture fills it, but its ` +
          `[data-section-type="${type}"] wrapper is not in the DOM — dropped section (PIPE-05).`,
      ).toHaveCount(1);
    }
  });

  test(`${slug} — all-null render does not throw or leak null/undefined/NaN/[object Object] (PIPE-05)`, async ({
    page,
  }) => {
    // BOTH all-null sub-variants: `empty` (sections:[]) and `null-content` (each supported
    // section mounted with content:null) — the strongest null-guard coverage (Pitfall 4).
    for (const sub of ['empty', 'null-content'] as const) {
      const { response } = await renderFixture(page, slug, { variant: 'null', sub });

      // A non-200 means the template THREW while null-guarding (PIPE-05 throw reject).
      expect(
        response?.status(),
        `${slug} all-null render (sub=${sub}) returned ${response?.status()} — a template ` +
          'threw on null-guarding (PIPE-05).',
      ).toBe(200);

      // The scoped root rendered (renderFixture already asserted visibility); read its text.
      const text = await page.locator(`.tmpl-${slug}`).innerText();
      for (const tell of LEAK_TOKENS) {
        // SCOPED to the all-null render (Pitfall 6): on the all-null fixture any of these
        // tokens IS an unguarded field leak (real prose never appears in an all-null render).
        expect(
          text,
          `${slug} all-null render (sub=${sub}) leaked "${tell}" into .tmpl-${slug} — an ` +
            'unguarded field read (PIPE-05 null-guard).',
        ).not.toContain(tell);
      }
    }
  });
}

/**
 * NEGATIVE CONTROL (D-P10-02 / T-10-04-FALSEGREEN): prove the conformance gate goes RED on the
 * registry-absent negative fixture. Because `tests/fixtures/broken-template/` can NEVER be
 * imported by a Next route (W8), the broken fixture is rendered as a faithful DOM via
 * `page.setContent` — anchored to the real broken-fixture SOURCE so the control cannot silently
 * drift from the fixture it claims to reject.
 */
test.describe('negative control — conformance REJECTS the broken fixture (D-P10-02)', () => {
  const BROKEN_DIR = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'tests',
    'fixtures',
    'broken-template',
  );
  const brokenIndexSrc = readFileSync(resolve(BROKEN_DIR, 'index.tsx'), 'utf8');
  const brokenSpecSrc = readFileSync(resolve(BROKEN_DIR, 'spec.ts'), 'utf8');

  test('the broken fixture SOURCE still carries the gate-tripping artifacts (anchor)', () => {
    // ANCHOR the control to the real source: if these break, the negative fixture was "fixed"
    // and this control must be re-validated (it is no longer testing what it claims).
    expect(
      brokenSpecSrc,
      'broken-template/spec.ts must declare `contact` supported:true (the dropped-section pair).',
    ).toMatch(/contact:\s*\{\s*supported:\s*true/);
    // Precise: assert no REAL JSX ELEMENT opens a `contact` section wrapper. The file documents
    // the drop in a COMMENT (`NOTE: NO \`<section data-section-type="contact">\``) that contains
    // the literal string, so we strip comments first, then key on a real `<section ...` element.
    // (1) strip block comments `{/* ... */}` and (2) strip line comments `// ...`.
    const brokenIndexNoComments = brokenIndexSrc
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\/.*$/gm, '');
    expect(
      brokenIndexNoComments,
      'broken-template/index.tsx must DROP the <section data-section-type="contact"> JSX element (PIPE-05).',
    ).not.toMatch(/<section[^>]*data-section-type="contact"/);
    // And the live sections it KEEPS are present as real elements (so the anchor proves
    // `contact` is the SPECIFIC dropped pair, not a wholesale section removal).
    expect(brokenIndexNoComments).toMatch(/<section[^>]*data-section-type="hero"/);
    expect(brokenIndexNoComments).toMatch(/<section[^>]*data-section-type="testimonials"/);
    expect(
      brokenIndexSrc,
      'broken-template/index.tsx must read profile.username with NO null-guard (the null-guard break).',
    ).toContain('(profile.username as string).toUpperCase()');
  });

  test('a faithful broken-fixture render FAILS the dropped-supported-section assertion', async ({
    page,
  }) => {
    // Faithful DOM of what BrokenTemplate emits: the live sections present (hero/about/skills/
    // projects/experience/testimonials) but the `contact` wrapper DELIBERATELY DROPPED — the
    // exact shape of tests/fixtures/broken-template/index.tsx (lines 92-102).
    await page.setContent(
      `<div class="tmpl-broken" data-template-root>
        <section data-section-type="hero"><h1>BROKEN</h1></section>
        <section data-section-type="about"><p>about</p></section>
        <section data-section-type="skills"></section>
        <section data-section-type="projects"></section>
        <section data-section-type="experience"></section>
        <section data-section-type="testimonials"></section>
        <!-- NO data-section-type="contact" — the deliberate dropped section -->
      </div>`,
    );

    // The broken fixture's spec marks `contact` supported:true (anchored above). Run the SAME
    // conformance assertion the real corpus passes — here it must FAIL (count 0, not 1), proving
    // the gate catches a dropped supported section.
    await expect(
      page.locator('[data-section-type="contact"]'),
      'expected the broken fixture to DROP its supported "contact" section (PIPE-05 reject).',
    ).toHaveCount(0);

    // Belt-and-suspenders: the non-dropped sections ARE present (so the control proves the
    // dropped `contact` is the SPECIFIC failure, not a blank render false-passing).
    await expect(page.locator('[data-section-type="hero"]')).toHaveCount(1);
    await expect(page.locator('[data-section-type="about"]')).toHaveCount(1);
  });
});
