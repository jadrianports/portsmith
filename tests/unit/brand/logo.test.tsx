/**
 * Wave 0 — brand component contract (BRAND-01 / D-05/D-06/D-07/D-09/D-14/D-15).
 *
 * Locks the token refs + a11y contract for the <Logo>/<Wordmark>/<Lockup> set.
 * We render each component to a static HTML string via `react-dom/server`
 * (`renderToStaticMarkup` — node env, no DOM, no new dep) and assert on the
 * emitted markup. This is the in-repo idiom (see tests/unit/markdown/render.test.ts).
 *
 * NOT tested here: the dark-mode recolor — it is CSS-only
 * (`@media (prefers-color-scheme: dark)` in globals.css) and is a Manual-Only
 * verification per 32-VALIDATION.md (not unit-testable in isolation).
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Logo } from '@/components/brand/logo';
import { Lockup } from '@/components/brand/lockup';
import { Wordmark } from '@/components/brand/wordmark';

describe('<Logo> — seal + copper "P", token-driven (D-05/D-06/D-09)', () => {
  it('standalone: emits both color tokens, the 32×32 viewBox, role="img" + aria-label', () => {
    const html = renderToStaticMarkup(<Logo />);
    // D-05/D-06: seal stroke = brand token, "P" fill = accent token (no hex).
    expect(html).toContain('var(--color-brand)');
    expect(html).toContain('var(--color-accent)');
    // Construction contract: 32×32 viewBox.
    expect(html).toContain('viewBox="0 0 32 32"');
    // Standalone a11y: announces as an image named "Portsmith".
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Portsmith"');
  });

  it('decorative: is aria-hidden and carries NO accessible name', () => {
    const html = renderToStaticMarkup(<Logo decorative />);
    expect(html).toContain('aria-hidden');
    expect(html).not.toContain('aria-label="Portsmith"');
  });

  it('contains NO hex literal in the SVG (D-06 — token-only color)', () => {
    const html = renderToStaticMarkup(<Logo />);
    // No `fill="#..."` / `stroke="#..."` — colors resolve only via CSS vars.
    expect(html).not.toMatch(/(?:fill|stroke)="#/);
    expect(html).not.toMatch(/#[0-9A-Fa-f]{3,6}/);
  });
});

describe('<Wordmark> — live Inter 600 text (D-15)', () => {
  it('renders the literal text "Portsmith"', () => {
    const html = renderToStaticMarkup(<Wordmark />);
    expect(html).toContain('Portsmith');
  });

  it('is real text (text-brand + font-semibold), not an SVG letterform', () => {
    const html = renderToStaticMarkup(<Wordmark />);
    expect(html).toContain('text-brand');
    expect(html).toContain('font-semibold');
    expect(html).not.toContain('<svg');
  });
});

describe('<Lockup> — Logo + Wordmark, mark-only collapse (D-14)', () => {
  it('contains both the seal SVG (brand token) and the "Portsmith" text', () => {
    const html = renderToStaticMarkup(<Lockup />);
    expect(html).toContain('var(--color-brand)');
    expect(html).toContain('Portsmith');
  });

  it('the logo within the lockup is aria-hidden — the wordmark carries the name', () => {
    const html = renderToStaticMarkup(<Lockup />);
    expect(html).toContain('aria-hidden');
    // The wordmark (not the logo) is the accessible name; no role="img" label on the mark.
    expect(html).not.toContain('aria-label="Portsmith"');
  });

  it('collapses to mark-only below `sm` (wordmark hidden until sm)', () => {
    const html = renderToStaticMarkup(<Lockup />);
    expect(html).toContain('hidden sm:inline');
  });
});
