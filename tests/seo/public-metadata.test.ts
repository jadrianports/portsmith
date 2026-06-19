/**
 * SHARE-03 / D-06 / D-05 — `buildPublicMetadata` image-ladder + Twitter-card coverage.
 *
 * Drives the SAME pure builder the SAFE-04 noindex-gate test drives
 * (`tests/unit/seo/noindex-gate.test.ts`), extended for the Phase-20 wiring:
 *
 *  - D-06 PRECEDENCE: `openGraph.images[0]` is the dynamic per-portfolio card
 *    (`siteUrl('/<u>/opengraph-image')`) when `og_image_url` is null, and the
 *    explicit `og_image_url` when one is set (the override wins — RESEARCH §3).
 *  - SHARE-03 NET-NEW TWITTER CARD: a `twitter` block with
 *    `card === 'summary_large_image'` whose `images[0]` MIRRORS `openGraph.images[0]`.
 *  - D-04: no portfolio-page image uses the static `og-default.png` (it is reserved
 *    for non-portfolio pages) — the og:image is ALWAYS the D-06 ladder output.
 *
 * Scaffolding (server-only mock, isPublishReady mock, makeData fixture, env pin,
 * assert-against-siteUrl) is copied from noindex-gate.test.ts so the robots gate
 * stays orthogonal — this file asserts the IMAGE wiring, that file asserts robots.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { siteUrl } from '@/lib/url';

vi.mock('server-only', () => ({}));

// Drive the gate outcome from the test. Default: ready (indexable) — image wiring
// is independent of the robots gate, so we keep it "ready" throughout.
const isPublishReady = vi.fn((..._a: unknown[]) => true);
vi.mock('@/lib/cms/completeness', () => ({
  isPublishReady: (...a: unknown[]) => isPublishReady(...a),
}));

const META = '@/lib/seo/public-metadata';

type Meta = {
  title?: unknown;
  description?: unknown;
  alternates?: { canonical?: string };
  robots?: { index?: boolean; follow?: boolean };
  openGraph?: { images?: string[] };
  twitter?: { card?: string; title?: unknown; description?: unknown; images?: string[] };
  // 29-01: the favicon `icons` ladder (D-04). `icon` is the App-Router metadata
  // shape — an array of `{ url, type }` descriptors.
  icons?: { icon?: Array<{ url?: unknown; type?: unknown }> };
};

async function loadBuilder(): Promise<
  (data: unknown, username: string) => Meta | Promise<Meta>
> {
  const mod = (await import(/* @vite-ignore */ META)) as {
    buildPublicMetadata: (data: unknown, username: string) => Meta | Promise<Meta>;
  };
  return mod.buildPublicMetadata;
}

/**
 * Minimal `PortfolioData`-shaped fixture (only the fields the builder reads).
 * `ogImageUrl` toggles the D-06 override case; `templateSlug` is carried for shape
 * parity (the builder derives the dynamic card URL from `username`, not the slug —
 * the slug→accent resolution lives in the OG route, not the metadata builder).
 */
function makeData(overrides?: {
  ogImageUrl?: string | null;
  // 29-01: the favicon ladder inputs (D-04). `undefined` keeps the default.
  faviconUrl?: string | null;
  avatarUrl?: string | null;
  displayName?: string;
  pageTitle?: string | null;
}) {
  return {
    profile: {
      display_name: overrides?.displayName ?? 'Ada Lovelace',
      avatar_url: overrides?.avatarUrl ?? null,
      headline: 'Engineer',
    },
    settings: {
      page_title: overrides?.pageTitle ?? null,
      meta_description: 'Portfolio of Ada',
      og_image_url: overrides?.ogImageUrl ?? null,
      favicon_url: overrides?.faviconUrl ?? null,
    },
    sections: [],
    recentPosts: [],
    templateSpec: {},
    templateSlug: 'minimal',
  };
}

const PREV = process.env.NEXT_PUBLIC_SITE_URL;
beforeAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://portsmith.vercel.app';
  isPublishReady.mockReturnValue(true);
});
afterAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = PREV;
});

describe('SHARE-03 / D-06 — buildPublicMetadata image ladder', () => {
  it('uses the dynamic per-portfolio card URL when og_image_url is null (D-06 default rung)', async () => {
    const build = await loadBuilder();
    const meta = await build(makeData({ ogImageUrl: null }), 'ada');
    expect(meta.openGraph?.images?.[0]).toBe(siteUrl('/ada/opengraph-image'));
  });

  it('uses the explicit og_image_url when set — the override WINS (D-06 top rung)', async () => {
    const build = await loadBuilder();
    const meta = await build(makeData({ ogImageUrl: 'https://cdn.example/custom-card.png' }), 'ada');
    expect(meta.openGraph?.images?.[0]).toBe('https://cdn.example/custom-card.png');
  });

  it('NEVER uses the static og-default.png for a portfolio page image (reserved for non-portfolio pages — D-04)', async () => {
    const build = await loadBuilder();
    const meta = await build(makeData({ ogImageUrl: null }), 'ada');
    expect(meta.openGraph?.images?.[0]).not.toContain('og-default.png');
  });
});

describe('SHARE-03 — net-new Twitter summary_large_image card', () => {
  it('emits a twitter block with card summary_large_image', async () => {
    const build = await loadBuilder();
    const meta = await build(makeData(), 'ada');
    expect(meta.twitter?.card).toBe('summary_large_image');
  });

  it('mirrors the openGraph image in twitter.images[0] (one resolved URL, both cards)', async () => {
    const build = await loadBuilder();
    const meta = await build(makeData({ ogImageUrl: null }), 'ada');
    expect(meta.twitter?.images?.[0]).toBe(meta.openGraph?.images?.[0]);
    expect(meta.twitter?.images?.[0]).toBe(siteUrl('/ada/opengraph-image'));
  });

  it('mirrors the override in BOTH cards when og_image_url is set (D-06)', async () => {
    const build = await loadBuilder();
    const meta = await build(makeData({ ogImageUrl: 'https://cdn.example/custom-card.png' }), 'ada');
    expect(meta.openGraph?.images?.[0]).toBe('https://cdn.example/custom-card.png');
    expect(meta.twitter?.images?.[0]).toBe('https://cdn.example/custom-card.png');
  });
});

// 29-01 (META-01 / D-07) — the NULL page_title render-time fallback. This ALREADY
// passes against the current builder (the fallback predates Phase 29) — pinned here
// as a regression guard so the SEO write work cannot silently remove it.
describe('META-01 / D-07 — page_title fallback', () => {
  it('NULL page_title falls back to "{displayName} — Portfolio"', async () => {
    const build = await loadBuilder();
    const meta = await build(makeData({ pageTitle: null, displayName: 'Grace Hopper' }), 'grace');
    expect(meta.title).toBe('Grace Hopper — Portfolio');
  });

  it('a set page_title WINS over the fallback', async () => {
    const build = await loadBuilder();
    const meta = await build(makeData({ pageTitle: 'Grace H. — Compiler Pioneer' }), 'grace');
    expect(meta.title).toBe('Grace H. — Compiler Pioneer');
  });
});

// 29-01 (META-03 / D-04) — the favicon `icons` ladder. RED until Plan 03 adds
// `resolveFaviconIcons(data)` and spreads it into the builder's return:
//   favicon_url  →  avatar_url  →  generated single-initial data:image/svg+xml URI.
// The emitted `<link rel=icon>` carries `type: 'image/webp'` (the stored WebP).
describe('META-03 / D-04 — favicon icons ladder', () => {
  it('emits favicon_url with type image/webp when set (top rung)', async () => {
    const build = await loadBuilder();
    const meta = await build(
      makeData({ faviconUrl: 'https://cdn.example/fav.webp' }),
      'ada',
    );
    expect(meta.icons?.icon?.[0]).toEqual({
      url: 'https://cdn.example/fav.webp',
      type: 'image/webp',
    });
  });

  it('falls back to avatar_url when favicon_url is null (middle rung)', async () => {
    const build = await loadBuilder();
    const meta = await build(
      makeData({ faviconUrl: null, avatarUrl: 'https://cdn.example/avatar.webp' }),
      'ada',
    );
    expect(meta.icons?.icon?.[0]?.url).toBe('https://cdn.example/avatar.webp');
  });

  it('falls back to a generated data:image/svg+xml URI when both are null (bottom rung)', async () => {
    const build = await loadBuilder();
    const meta = await build(makeData({ faviconUrl: null, avatarUrl: null }), 'ada');
    const url = meta.icons?.icon?.[0]?.url;
    expect(typeof url).toBe('string');
    expect(url as string).toContain('data:image/svg+xml,');
  });
});
