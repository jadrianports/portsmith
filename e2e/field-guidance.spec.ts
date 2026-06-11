/**
 * Phase 17 / UX-01 — D-01 (ExampleChip + seeded-block clear) + D-02 (per-field
 * helper text + `e.g.` example placeholders on the SIMPLE forms). The first-run
 * editor-guidance surfaces from 17-06, asserted against the REAL editor.
 *
 * MODEL: e2e/profile-editor.spec.ts (the same `createConfirmedOwner` →
 * `signInAsOwner` cookie-injected session, the `< lg` viewport so selecting a rail
 * entry swaps to the full-width form panel, and the `getByLabel` / `getByRole`
 * idioms). A fresh confirmed owner is bootstrapped with the enriched migration-006
 * placeholder content — so hero/about/contact MOUNT holding the untouched seed and
 * the ExampleChip is present (the D-01 contract: chip IFF the block still holds
 * untouched seed).
 *
 * WHAT THIS SPEC PROVES:
 *   D-02 — each named field (hero heading/subheading, about bio, contact heading)
 *     renders its helper Caption tied to the input via `aria-describedby`, plus an
 *     `e.g. …` example placeholder. The helper copy matches the 17-UI-SPEC
 *     Copywriting table verbatim.
 *   D-01 — a SEEDED simple section shows the "Example · tap to clear" chip; clicking
 *     the × (aria-label "Clear example content") empties the block's fields, removes
 *     the chip, and moves focus to the first field; and EDITING any field removes
 *     the chip immediately (the "chip vanishes on edit" rule).
 *
 * NOTE on the seeded-vs-touched contract: hero MOUNTS holding the bootstrap seed
 * (heading "Hi, I'm [Your Name]" + subheading "I build things for the web"), so the
 * chip is present on first open. Editing OR clearing a field makes the block
 * "theirs" and the chip never returns.
 *
 * Run command: `npx playwright test e2e/field-guidance.spec.ts`.
 */
import { expect, test } from '@playwright/test';

import {
  createConfirmedOwner,
  deleteOwner,
  signInAsOwner,
  type TestOwner,
} from './helpers/cms-auth';

test.describe('UX-01 — first-run field guidance (D-02) + ExampleChip (D-01)', () => {
  let owner: TestOwner;

  test.beforeAll(async () => {
    owner = await createConfirmedOwner('guide');
  });

  test.afterAll(async () => {
    await deleteOwner(owner);
  });

  test('D-02 — hero/about/contact fields expose helper via aria-describedby + e.g. placeholder', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    // < lg so selecting a rail entry swaps the rail for the form panel.
    await page.setViewportSize({ width: 800, height: 1000 });

    await signInAsOwner(page, owner);

    // ── HERO ──────────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Hero', exact: true }).click();

    const heroHeading = page.getByLabel('Heading', { exact: true });
    await expect(heroHeading).toBeVisible();
    // The helper is tied to the field via aria-describedby; the referenced element
    // carries the verbatim UI-SPEC copy.
    await expectHelper(page, heroHeading, 'One line that says who you are and what you do.');
    // …and the field carries the `e.g. …` example placeholder.
    await expect(heroHeading).toHaveAttribute(
      'placeholder',
      'e.g. Product designer crafting calm, useful interfaces',
    );

    const heroSub = page.getByLabel('Subheading', { exact: true });
    await expectHelper(page, heroSub, 'A short supporting line under your headline.');
    await expect(heroSub).toHaveAttribute(
      'placeholder',
      'e.g. 8 years turning complex problems into simple products',
    );

    // ── ABOUT ─────────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'About', exact: true }).click();
    const bio = page.getByLabel('Bio', { exact: true });
    await expect(bio).toBeVisible();
    await expectHelper(
      page,
      bio,
      "A few sentences in your own voice — your story, focus, and what you're known for.",
    );
    await expect(bio).toHaveAttribute(
      'placeholder',
      "e.g. I'm a marketer who helps early-stage teams find their first 1,000 customers…",
    );

    // ── CONTACT ───────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Contact', exact: true }).click();
    const contactHeading = page.getByLabel('Heading', { exact: true });
    await expect(contactHeading).toBeVisible();
    await expectHelper(page, contactHeading, 'Invite visitors to reach out.');
    await expect(contactHeading).toHaveAttribute('placeholder', "e.g. Let's work together");
  });

  test('D-02 — a field error REPLACES the helper line (error supersedes helper)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 800, height: 1000 });
    await signInAsOwner(page, owner);

    await page.getByRole('button', { name: 'Hero', exact: true }).click();
    const heroHeading = page.getByLabel('Heading', { exact: true });
    await expect(heroHeading).toBeVisible();

    // At rest the helper line is present.
    const helperText = 'One line that says who you are and what you do.';
    await expect(page.getByText(helperText)).toBeVisible();

    // Force a server-rejectable value: hero.heading is z.string().max(100). The
    // client <Textarea maxLength={100}> blocks typing past 100, so inject a 101-char
    // value directly + dispatch the input event (React picks it up), then Save. The
    // server re-parse returns a field error which REPLACES the helper line.
    const tooLong = 'x'.repeat(101);
    await heroHeading.evaluate((el, value) => {
      const node = el as HTMLTextAreaElement;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      setter?.call(node, value);
      node.dispatchEvent(new Event('input', { bubbles: true }));
    }, tooLong);

    await page.getByRole('button', { name: 'Save changes' }).click();

    // The field now shows an error (aria-invalid) AND the helper line is gone —
    // error supersedes helper (the shipped Input/Textarea precedence, D-02).
    await expect(heroHeading).toHaveAttribute('aria-invalid', 'true', { timeout: 30_000 });
    await expect(page.getByText(helperText)).toHaveCount(0);
  });

  test('D-01 — seeded block shows the Example chip; clear empties + refocuses; edit removes it', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 800, height: 1000 });
    await signInAsOwner(page, owner);

    // Open Hero — it MOUNTS holding the untouched bootstrap seed, so the chip shows.
    await page.getByRole('button', { name: 'Hero', exact: true }).click();
    const heroHeading = page.getByLabel('Heading', { exact: true });
    await expect(heroHeading).toBeVisible();

    // The "Example · tap to clear" chip is present (the WORD carries the state —
    // color-independence). The clear × carries aria-label "Clear example content".
    await expect(page.getByText('Example · tap to clear')).toBeVisible();
    const clearBtn = page.getByRole('button', { name: 'Clear example content' });
    await expect(clearBtn).toBeVisible();

    // One tap clears the block to EMPTY fields, removes the chip, and moves focus to
    // the first field (the Heading textarea).
    await clearBtn.click();
    await expect(heroHeading).toHaveValue('');
    await expect(page.getByLabel('Subheading', { exact: true })).toHaveValue('');
    await expect(page.getByText('Example · tap to clear')).toHaveCount(0);
    await expect(heroHeading).toBeFocused();
    // The polite announcement region carries the cleared message.
    await expect(page.getByText('Example content cleared')).toBeAttached();

    // ── The "vanishes on edit" rule: re-open Contact (still seeded) and prove that
    //    EDITING a field (not clearing) removes the chip immediately. ──
    await page.getByRole('button', { name: 'Contact', exact: true }).click();
    const contactHeading = page.getByLabel('Heading', { exact: true });
    await expect(contactHeading).toBeVisible();
    await expect(page.getByText('Example · tap to clear')).toBeVisible();

    // Type into the heading → the block is now "theirs"; the chip disappears.
    await contactHeading.fill('My own contact heading');
    await expect(page.getByText('Example · tap to clear')).toHaveCount(0);
  });
});

/**
 * Assert a field's helper is wired via `aria-describedby` (the shipped Input/Textarea
 * `helper` prop renders `<p id="{fieldId}-helper">` and points the field's
 * `aria-describedby` at it) AND that the referenced element carries the expected
 * verbatim copy. This proves the a11y association, not just that the text exists.
 */
async function expectHelper(
  page: import('@playwright/test').Page,
  field: import('@playwright/test').Locator,
  expectedCopy: string,
): Promise<void> {
  const describedBy = await field.getAttribute('aria-describedby');
  expect(describedBy, 'field should have aria-describedby for its helper').toBeTruthy();
  // The helper id is the (single) describedby token ending in -helper at rest.
  const helper = page.locator(`#${describedBy}`);
  await expect(helper).toHaveText(expectedCopy);
}
