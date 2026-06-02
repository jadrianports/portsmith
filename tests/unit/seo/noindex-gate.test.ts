/**
 * SAFE-04 — RED scaffold (Wave 0, Plan 06-01). GREENED BY 06-03-T3.
 *
 * Encodes the metadata-side of the noindex gate: the not-yet-existing
 * `buildPublicMetadata(data, username)` helper (`@/lib/seo/public-metadata`) —
 * the gate-applied metadata builder the public `generateMetadata` delegates to.
 * Contract (D-11): when the SAFE-04 publish-gate predicate FAILS (incomplete /
 * placeholder page) the metadata carries `robots: { index: false }`; when it
 * PASSES, `robots` is OMITTED (default-indexable). Either way the page stays
 * reachable — a title is always returned (the page is public, just not indexed).
 * Canonical is always `siteUrl('/'+username)` (never a request host — PUB-03).
 *
 * RED via the [05-01] runtime variable-specifier import: the helper does not exist
 * yet → ERR_MODULE_NOT_FOUND at runtime; `tsc --noEmit` stays 0. We drive the gate
 * by mocking `@/lib/cms/completeness`'s `isPublishReady` so this spec asserts the
 * metadata WIRING (robots present/absent on fail/pass), independent of the gate's
 * own predicate logic (which `publish-gate.test.ts` covers).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { siteUrl } from '@/lib/url';

vi.mock('server-only', () => ({}));

// Drive the gate outcome from the test. Default: ready (indexable).
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
};

async function loadBuilder(): Promise<
  (data: unknown, username: string) => Meta | Promise<Meta>
> {
  const mod = (await import(/* @vite-ignore */ META)) as {
    buildPublicMetadata: (data: unknown, username: string) => Meta | Promise<Meta>;
  };
  return mod.buildPublicMetadata;
}

function makeData() {
  return {
    profile: { display_name: 'Ada Lovelace', avatar_url: null, headline: 'Engineer' },
    settings: { meta_description: 'Portfolio of Ada', og_image_url: null },
    sections: [],
    recentPosts: [],
    templateSpec: {},
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

describe('SAFE-04 — public metadata robots gate', () => {
  it('emits robots:{index:false} when the gate predicate FAILS (incomplete page)', async () => {
    const build = await loadBuilder();
    isPublishReady.mockReturnValue(false);
    const meta = await build(makeData(), 'ada');
    expect(meta.robots?.index).toBe(false);
    // Page is still reachable: a title is present, canonical is the env-driven URL.
    expect(meta.title).toBeTruthy();
    expect(meta.alternates?.canonical).toBe(siteUrl('/ada'));
  });

  it('OMITS robots (default-indexable) when the gate PASSES (complete page)', async () => {
    const build = await loadBuilder();
    isPublishReady.mockReturnValue(true);
    const meta = await build(makeData(), 'ada');
    // No explicit noindex when the page is reasonably complete.
    expect(meta.robots?.index).not.toBe(false);
    // Still reachable + canonical preserved.
    expect(meta.title).toBeTruthy();
    expect(meta.alternates?.canonical).toBe(siteUrl('/ada'));
  });
});
