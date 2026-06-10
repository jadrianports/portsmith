/**
 * RED (Wave 0, 13.2-01) — SC-3 / D-18: published posts of publish-ready portfolios
 * enter the sitemap.
 *
 * `app/sitemap.ts` today emits one `siteUrl('/<username>')` per public profile (read
 * from the `public_profiles` view). D-18 extends it so each PUBLISHED post of a
 * publish-ready portfolio also gets a `siteUrl('/<username>/blog/<slug>')` entry —
 * read cookie-LESS from `public_blog_posts` (the DEFINER view that already filters
 * published + portfolio-published, mirroring the get-posts.ts read shape). The
 * isPublishReady noindex gate is inherited, so unpublished/withheld posts never appear.
 *
 * This test mocks `@supabase/supabase-js`'s `createClient` so the cookie-less client
 * returns:
 *   - one publish-ready profile (`username: 'jadrianports'`) from `public_profiles`
 *   - one published post (`slug: 'first-transmission'`) from `public_blog_posts`
 * then asserts the default sitemap's returned array contains the post URL.
 *
 * RED today: the current sitemap never queries `public_blog_posts` and emits no
 * `/blog/` entry, so the post URL is absent — the assertion fails, which IS the RED
 * state. Greened when 13.2 extends the sitemap per Pattern 6.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { siteUrl } from '@/lib/url';

const USERNAME = 'jadrianports';
const POST_SLUG = 'first-transmission';

/**
 * A minimal Supabase-js mock: `from(table).select(...)` resolves to the rows for that
 * table. `select` returns a thenable that also exposes `.eq(...)` so both the bare
 * `select()` (profiles) and a filtered `select().eq()` (posts) shapes work.
 */
function mockDb() {
  const rowsByTable: Record<string, unknown[]> = {
    public_profiles: [{ username: USERNAME }],
    public_blog_posts: [{ slug: POST_SLUG, username: USERNAME }],
  };
  return {
    from(table: string) {
      const rows = rowsByTable[table] ?? [];
      const result = { data: rows, error: null };
      const builder = {
        eq: () => Promise.resolve(result),
        then: (resolve: (v: typeof result) => unknown) => resolve(result),
      };
      return { select: () => builder };
    },
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockDb(),
}));

describe('SC-3 / D-18 — published posts enter the sitemap', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('includes a siteUrl("/<username>/blog/<slug>") entry for a published post', async () => {
    // Import after the mock is registered so the sitemap uses the stubbed client.
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(siteUrl(`/${USERNAME}/blog/${POST_SLUG}`));
  });
});
