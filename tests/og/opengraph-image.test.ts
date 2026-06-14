/**
 * SHARE-01 / SHARE-02 — the opengraph-image Route Handler renders a real PNG.
 *
 * Invokes the route's `GET(req, { params })` Route-Handler export with the Next-16 awaited-params
 * shape and asserts the returned `Response` is a real 1200×630 PNG: `content-type` includes `image/png` and
 * the body is non-trivial (> 5000 bytes — a real card is tens of KB; a broken render is tiny or
 * throws). This exercises the full `new ImageResponse(<ShareCard/>, { fonts })` path including the
 * genuine `node:fs` Inter `.ttf` reads (Plan-01 bundled them), so it proves Satori actually
 * rasterizes the card with the bundled fonts — not just that the route is wired.
 *
 * `@/lib/portfolio/get-portfolio` is MOCKED to a fixture `PortfolioData` so the test runs without
 * the live Supabase stack (the route's cookie-less read is unit-isolated here). `server-only` is
 * stubbed via the vitest alias; `next/navigation`'s `notFound` is mocked to a throw so the
 * null-data branch is assertable.
 *
 * Scaffolding (the `server-only` mock + fixture) follows `tests/unit/seo/noindex-gate.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// `notFound()` throws a sentinel so the null-data branch can be asserted (mirrors Next's behavior).
class NotFoundError extends Error {}
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFoundError('NEXT_NOT_FOUND');
  },
}));

// Drive the route's cookie-less read from the test — default: a published fixture portfolio.
const getPortfolioByUsername = vi.fn();
vi.mock('@/lib/portfolio/get-portfolio', () => ({
  getPortfolioByUsername: (...a: unknown[]) => getPortfolioByUsername(...a),
}));

/** A minimal `PortfolioData`-shaped fixture — only the columns the OG route reads. */
function makeData(overrides: Record<string, unknown> = {}) {
  return {
    profile: { display_name: 'Ada Lovelace', headline: 'Computing Pioneer', avatar_url: null },
    settings: { og_image_url: null },
    sections: [],
    portfolioId: 'p1',
    recentPosts: [],
    templateSlug: 'edgerunner-v2',
    templateSpec: {},
    ...overrides,
  };
}

const ROUTE = '@/app/(portfolio)/[username]/opengraph-image/route';

async function loadImage(): Promise<
  (params: { username: string }) => Promise<Response>
> {
  const mod = (await import(/* @vite-ignore */ ROUTE)) as {
    GET: (
      req: Request,
      ctx: { params: Promise<{ username: string }> },
    ) => Promise<Response>;
  };
  // Adapt the Route-Handler GET(req, ctx) signature to the test's params-only caller.
  return (params: { username: string }) =>
    mod.GET(new Request('https://portsmith.vercel.app/'), {
      params: Promise.resolve(params),
    });
}

const PREV = process.env.NEXT_PUBLIC_SITE_URL;
beforeAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://portsmith.vercel.app';
});
afterAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = PREV;
});

describe('SHARE-01 — GET /<username>/opengraph-image renders a real 1200×630 PNG', () => {
  it('returns image/png with a non-trivial body (> 5000 bytes) for the founder slug', async () => {
    getPortfolioByUsername.mockResolvedValue(makeData());
    const Image = await loadImage();

    const res = await Image({ username: 'jadrianports' });

    expect(res).toBeInstanceOf(Response);
    expect(res.headers.get('content-type')).toContain('image/png');
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.byteLength).toBeGreaterThan(5000);
    // PNG magic bytes: 89 50 4E 47 — proves a genuine PNG, not an error page.
    expect(Array.from(body.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('renders cleanly when the headline is null (drops the line — never blank, SHARE-04)', async () => {
    getPortfolioByUsername.mockResolvedValue(
      makeData({ profile: { display_name: 'Cher', headline: null, avatar_url: null } }),
    );
    const Image = await loadImage();

    const res = await Image({ username: 'cher' });

    expect(res.headers.get('content-type')).toContain('image/png');
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.byteLength).toBeGreaterThan(5000);
  });

  it('calls notFound() when the cookie-less read returns null (D-24 — no blank card)', async () => {
    getPortfolioByUsername.mockResolvedValue(null);
    const Image = await loadImage();

    await expect(Image({ username: 'ghost' })).rejects.toThrow(NotFoundError);
  });
});

describe('SHARE-02 / D-22 — the route mirrors page.tsx ISR config + introduces zero dynamism', () => {
  const SRC = readFileSync(
    join(process.cwd(), 'src/app/(portfolio)/[username]/opengraph-image/route.tsx'),
    'utf8',
  );
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it("exports runtime = 'nodejs' (node:fs font reads + Satori)", async () => {
    const mod = await import(/* @vite-ignore */ ROUTE);
    expect(mod.runtime).toBe('nodejs');
  });

  it('exports revalidate = 3600 (mirrors page.tsx ISR backstop)', async () => {
    const mod = await import(/* @vite-ignore */ ROUTE);
    expect(mod.revalidate).toBe(3600);
  });

  it('exports dynamicParams = true (mirrors page.tsx)', async () => {
    const mod = await import(/* @vite-ignore */ ROUTE);
    expect(mod.dynamicParams).toBe(true);
  });

  it('exports SIZE = { width: 1200, height: 630 } (the ImageResponse dimensions)', async () => {
    const mod = await import(/* @vite-ignore */ ROUTE);
    expect(mod.SIZE).toEqual({ width: 1200, height: 630 });
  });

  it("exports CONTENT_TYPE = 'image/png'", async () => {
    const mod = await import(/* @vite-ignore */ ROUTE);
    expect(mod.CONTENT_TYPE).toBe('image/png');
  });

  it('exports a GET Route-Handler (option b — not the default-Image metadata-file shape)', async () => {
    const mod = (await import(/* @vite-ignore */ ROUTE)) as { GET?: unknown; default?: unknown };
    expect(typeof mod.GET).toBe('function');
    // No default `Image` export — the metadata-file convention would auto-inject og:image.
    expect(mod.default).toBeUndefined();
  });

  it('generateStaticParams() returns exactly [{ username: "jadrianports" }] (matches page.tsx)', async () => {
    const mod = (await import(/* @vite-ignore */ ROUTE)) as {
      generateStaticParams: () => Promise<{ username: string }[]>;
    };
    await expect(mod.generateStaticParams()).resolves.toEqual([{ username: 'jadrianports' }]);
  });

  it('reuses getPortfolioByUsername + accentForSlug + new ImageResponse (the load-bearing links)', () => {
    expect(CODE).toMatch(/getPortfolioByUsername/);
    expect(CODE).toMatch(/accentForSlug/);
    expect(CODE).toMatch(/new ImageResponse/);
  });

  it('adds NO cookies()/headers()/request-host read and NO service-role import (D-22/T-20-03)', () => {
    expect(CODE).not.toMatch(/cookies\(/);
    expect(CODE).not.toMatch(/headers\(/);
    expect(CODE).not.toMatch(/service-role/);
    expect(CODE).not.toMatch(/supabaseAdmin/);
    // no request-host read — URLs are env-driven via siteOrigin() only.
    expect(CODE).not.toMatch(/req\.headers/);
  });

  it('contains NO `<img` raster embed (monogram-primary — zero SSRF surface, T-20-04)', () => {
    expect(CODE).not.toMatch(/<img\b/);
  });
});
