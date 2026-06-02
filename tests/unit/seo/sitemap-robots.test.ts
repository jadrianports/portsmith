/**
 * SEO-02 — RED scaffold (Wave 0, Plan 06-01). GREENED BY 06-03-T2.
 *
 * Encodes the contract of the not-yet-existing `app/sitemap.ts` + `app/robots.ts`
 * (D-09). `sitemap` lists ONLY published, non-deleted, non-locked portfolios —
 * satisfied by reading the `public_profiles` view (which already encodes that
 * filter) through a COOKIE-LESS anon client, so the build never couples to a
 * request host. `robots` disallows `/dashboard`, `/api`, `/admin` and points at
 * the sitemap via `siteUrl()`.
 *
 * RED via the [05-01] runtime variable-specifier import: neither `@/app/sitemap`
 * nor `@/app/robots` exists yet → ERR_MODULE_NOT_FOUND at runtime, `tsc` stays 0.
 *
 * We mock `@supabase/supabase-js` `createClient` so the anon `public_profiles`
 * read returns a deterministic two-row set: one published username + one filtered
 * (null username, as a filtered/withheld row presents on the view). The sitemap
 * must include only the real username entry (plus the site root).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Anon cookie-less client: `from('public_profiles').select('username')` resolves a
// published row + a withheld row (null username). Only the published one belongs
// in the sitemap.
const profilesSelect = vi.fn(async () => ({
  data: [{ username: 'ada' }, { username: null }],
  error: null,
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({ select: profilesSelect })),
  })),
}));

const SITEMAP = '@/app/sitemap';
const ROBOTS = '@/app/robots';

async function loadSitemap(): Promise<
  () => Promise<Array<{ url: string }>>
> {
  const mod = (await import(/* @vite-ignore */ SITEMAP)) as {
    default: () => Promise<Array<{ url: string }>>;
  };
  return mod.default;
}

async function loadRobots(): Promise<
  () => {
    rules: { userAgent?: string; allow?: string; disallow?: string[] };
    sitemap?: string;
  }
> {
  const mod = (await import(/* @vite-ignore */ ROBOTS)) as {
    default: () => {
      rules: { userAgent?: string; allow?: string; disallow?: string[] };
      sitemap?: string;
    };
  };
  return mod.default;
}

const PREV = process.env.NEXT_PUBLIC_SITE_URL;
beforeAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://portsmith.vercel.app';
});
afterAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = PREV;
});

describe('SEO-02 — app/sitemap.ts', () => {
  it('lists only published usernames (from public_profiles) plus the site root', async () => {
    const sitemap = await loadSitemap();
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    // The published username is present...
    expect(urls).toContain('https://portsmith.vercel.app/ada');
    // ...the withheld (null-username) row is NOT included.
    expect(urls.some((u) => u.endsWith('/null'))).toBe(false);
    // No entry is undefined/malformed.
    expect(urls.every((u) => typeof u === 'string' && u.length > 0)).toBe(true);
  });
});

describe('SEO-02 — app/robots.ts', () => {
  it('disallows /dashboard, /api, and /admin and references the sitemap via siteUrl', async () => {
    const robots = await loadRobots();
    const r = robots();
    const disallow = r.rules.disallow ?? [];
    expect(disallow).toEqual(
      expect.arrayContaining(['/dashboard', '/api', '/admin']),
    );
    expect(r.sitemap).toBe('https://portsmith.vercel.app/sitemap.xml');
  });
});
