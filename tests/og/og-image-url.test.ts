/**
 * SHARE-03 / D-06 — the share-image precedence URL builder (`shareImageUrl`).
 *
 * The D-06 ladder, extracted as a pure, env-driven helper so `/[username]`, `/blog`, and
 * `/services` (D-05) share ONE URL source and the precedence is unit-testable:
 *
 *   explicit `settings.og_image_url`  →  dynamic per-portfolio card  (→ static og-default.png
 *   is reserved for NON-portfolio pages per D-04, so it is NOT this builder's concern).
 *
 * Scaffolding copied from `tests/unit/seo/noindex-gate.test.ts`: the `server-only` mock + the
 * `beforeAll`/`afterAll` env pin so `siteUrl()` is deterministic, asserting against `siteUrl(...)`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { shareImageUrl } from '@/lib/og/og-image-url';
import { siteUrl } from '@/lib/url';

vi.mock('server-only', () => ({}));

const PREV = process.env.NEXT_PUBLIC_SITE_URL;
beforeAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://portsmith.vercel.app';
});
afterAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = PREV;
});

describe('SHARE-03 / D-06 — shareImageUrl precedence ladder', () => {
  it('returns the dynamic-card URL (siteUrl /<username>/opengraph-image) when og_image_url is null', () => {
    expect(shareImageUrl('jadrianports', null)).toBe(
      siteUrl('/jadrianports/opengraph-image'),
    );
  });

  it('returns the explicit override when og_image_url is set (D-06 override wins)', () => {
    expect(shareImageUrl('jadrianports', 'https://x/custom.png')).toBe(
      'https://x/custom.png',
    );
  });

  it('the dynamic-card URL is env-driven (NEXT_PUBLIC_SITE_URL), never a request host', () => {
    expect(shareImageUrl('ada', null)).toBe('https://portsmith.vercel.app/ada/opengraph-image');
  });

  it('an override is returned verbatim regardless of the env origin', () => {
    expect(shareImageUrl('ada', 'https://cdn.example.com/me.png')).toBe(
      'https://cdn.example.com/me.png',
    );
  });
});
