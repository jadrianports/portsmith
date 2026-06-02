/**
 * SEO-01 — RED scaffold (Wave 0, Plan 06-01). GREENED BY 06-03-T1.
 *
 * Encodes the contract of the not-yet-existing `buildPersonLd(data, username)`
 * (`@/lib/seo/person-jsonld`) — the pure, template-agnostic `Person` JSON-LD
 * builder (D-08). The load-bearing invariant: every absolute URL is derived from
 * `siteUrl()` (env-driven), NEVER a request host (PUB-03). Optional fields
 * (`image` ← avatar, `jobTitle` ← headline) are OMITTED when absent so the JSON-LD
 * never carries empty/placeholder properties.
 *
 * RED via the [05-01] runtime variable-specifier import: `@/lib/seo/person-jsonld`
 * does not exist yet, so the import throws ERR_MODULE_NOT_FOUND at runtime while
 * `tsc --noEmit` stays 0 (no static specifier to resolve). We pin `siteUrl` to a
 * known origin via the env so the canonical-URL assertion is deterministic and
 * independent of any request host.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { siteUrl } from '@/lib/url';

const LD = '@/lib/seo/person-jsonld';

type PersonLd = {
  '@context': string;
  '@type': string;
  name: string;
  url: string;
  image?: string;
  jobTitle?: string;
  sameAs?: string[];
};

async function loadBuildPersonLd(): Promise<
  (data: unknown, username: string) => PersonLd
> {
  const mod = (await import(/* @vite-ignore */ LD)) as {
    buildPersonLd: (data: unknown, username: string) => PersonLd;
  };
  return mod.buildPersonLd;
}

/** A minimal PortfolioData-shaped fixture (only the fields buildPersonLd reads). */
function makeData(overrides: {
  display_name?: string | null;
  avatar_url?: string | null;
  headline?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  twitter_url?: string | null;
}) {
  return {
    profile: {
      display_name: overrides.display_name ?? null,
      avatar_url: overrides.avatar_url ?? null,
      headline: overrides.headline ?? null,
    },
    settings: {
      github_url: overrides.github_url ?? null,
      linkedin_url: overrides.linkedin_url ?? null,
      twitter_url: overrides.twitter_url ?? null,
    },
    sections: [],
    recentPosts: [],
    templateSpec: {},
  };
}

// Pin the env origin so siteUrl() is deterministic (never a request host).
const PREV = process.env.NEXT_PUBLIC_SITE_URL;
beforeAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://portsmith.vercel.app';
});
afterAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = PREV;
});

describe('SEO-01 — buildPersonLd', () => {
  it('returns a schema.org Person with the canonical url from siteUrl (never the request host)', async () => {
    const buildPersonLd = await loadBuildPersonLd();
    const ld = buildPersonLd(
      makeData({ display_name: 'Ada Lovelace' }),
      'ada',
    );
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Person');
    expect(ld.name).toBe('Ada Lovelace');
    // The url MUST equal siteUrl('/ada') — env-driven, host-independent (PUB-03).
    expect(ld.url).toBe(siteUrl('/ada'));
  });

  it('falls back to the username when display_name is absent', async () => {
    const buildPersonLd = await loadBuildPersonLd();
    const ld = buildPersonLd(makeData({ display_name: null }), 'ada');
    expect(ld.name).toBe('ada');
  });

  it('OMITS image and jobTitle when avatar_url and headline are absent', async () => {
    const buildPersonLd = await loadBuildPersonLd();
    const ld = buildPersonLd(
      makeData({ display_name: 'Ada', avatar_url: null, headline: null }),
      'ada',
    );
    expect('image' in ld).toBe(false);
    expect('jobTitle' in ld).toBe(false);
  });

  it('INCLUDES image and jobTitle when present', async () => {
    const buildPersonLd = await loadBuildPersonLd();
    const ld = buildPersonLd(
      makeData({
        display_name: 'Ada',
        avatar_url: 'https://cdn.example/avatar.webp',
        headline: 'Mathematician',
      }),
      'ada',
    );
    expect(ld.image).toBe('https://cdn.example/avatar.webp');
    expect(ld.jobTitle).toBe('Mathematician');
  });
});
