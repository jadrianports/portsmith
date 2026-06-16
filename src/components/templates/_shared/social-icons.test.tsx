/**
 * 25-01 Task 1 — the shared 11-platform `SocialIcon` module (D-01/D-02/D-03).
 *
 * Render-FREE-of-jsdom: the unit project runs the `node` env with NO
 * @testing-library / jsdom (the project convention — `socials-reorder.test.ts`
 * precedent). A pure Server Component that returns inline SVG markup is exercised
 * with `renderToStaticMarkup` (react-dom/server, available under node) — the same
 * static HTML the SSG page emits. No DOM, no client boundary.
 *
 * Asserts the behavior block:
 *   - each of the 11 brand slugs renders an <svg> with a <path> (brand mark) and the
 *     SVG carries aria-hidden,
 *   - `website` AND any unknown slug fall back to the lucide Globe (an <svg> WITHOUT
 *     a brand <path d> — Globe is a multi-element stroke icon, no fill path),
 *   - slug matching is case-insensitive,
 *   - PLATFORM_LABELS exposes a human label for all 11 slugs.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PLATFORM_LABELS, SocialIcon } from './social-icons';

/** The 10 slugs that have a bespoke hand-coded brand <path> (everything but website). */
const BRAND_SLUGS = [
  'github',
  'linkedin',
  'x',
  'instagram',
  'youtube',
  'tiktok',
  'dribbble',
  'behance',
  'facebook',
  'threads',
] as const;

const ALL_SLUGS = [...BRAND_SLUGS, 'website'] as const;

describe('SocialIcon', () => {
  it('renders a brand <svg> with a fill <path> for each of the 10 brand slugs', () => {
    for (const slug of BRAND_SLUGS) {
      const html = renderToStaticMarkup(<SocialIcon platform={slug} />);
      expect(html, slug).toContain('<svg');
      expect(html, slug).toContain('aria-hidden="true"');
      // A bespoke brand mark = a single filled <path d="…"> on a currentColor svg.
      expect(html, slug).toMatch(/<path[^>]*\sd="/);
      expect(html, slug).toContain('fill="currentColor"');
    }
  });

  it('falls back to the lucide Globe for `website` and any unknown slug', () => {
    for (const slug of ['website', 'unknownXYZ', 'myspace']) {
      const html = renderToStaticMarkup(<SocialIcon platform={slug} />);
      expect(html, slug).toContain('<svg');
      expect(html, slug).toContain('aria-hidden="true"');
      // The Globe is a lucide stroke icon (stroke=currentColor, multi <circle>/<path>
      // stroke elements) — it is NOT the single filled brand-path shape.
      expect(html, slug).not.toContain('fill="currentColor"');
    }
  });

  it('matches slugs case-insensitively (GitHub === github)', () => {
    const lower = renderToStaticMarkup(<SocialIcon platform="github" />);
    const upper = renderToStaticMarkup(<SocialIcon platform="GitHub" />);
    expect(upper).toBe(lower);
  });

  it('honours the size prop', () => {
    const html = renderToStaticMarkup(<SocialIcon platform="github" size={24} />);
    expect(html).toContain('width="24"');
    expect(html).toContain('height="24"');
  });

  it('exposes a PLATFORM_LABELS entry for all 11 slugs', () => {
    for (const slug of ALL_SLUGS) {
      expect(PLATFORM_LABELS[slug], slug).toBeTruthy();
    }
    expect(PLATFORM_LABELS.x).toBe('X');
    expect(PLATFORM_LABELS.website).toBe('Website');
    expect(PLATFORM_LABELS.github).toBe('GitHub');
  });
});
