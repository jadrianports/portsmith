/**
 * edgerunner-v2 dedicated /blog/[slug] post page — `/${username}/blog/${slug}`.
 *
 * STATIC / ISR (D-22): mirrors services pattern — cookie-less anon data fetch,
 * `revalidate=3600`, cartesian `generateStaticParams` (username × 3 post slugs)
 * so ALL post pages are prerendered as ● SSG at build time.
 *
 * GATE: if template !== 'edgerunner-v2' → notFound().
 *       if slug not in POST_SLUGS → notFound().
 *
 * NEXT 16 ASYNC PARAMS: `params` is a Promise — MUST be `await`ed.
 *
 * SERVER / CLIENT SPLIT:
 *   - `post-data.ts` (no 'use client') → safe to import here for metadata/gate.
 *   - `blog-post-content.tsx` ('use client') → receives `slug` and looks up the
 *     full post (including the Body component) at render time on the client.
 *
 * SYNTAX HIGHLIGHTING:
 *   All code blocks for the post are pre-highlighted here (server, build time)
 *   via shiki → highlightCode().  The resulting serializable token arrays are
 *   passed as `codeTokens` props to the client component, which threads them
 *   down to each <CodeBlock tokens={...}>.  No dangerouslySetInnerHTML.
 *   Shiki runs only in this server route chunk — the main /[username] page is
 *   never affected.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getPortfolioByUsername } from '@/lib/portfolio/get-portfolio';
import { EdgerunnerV2PageShell } from '@/components/templates/edgerunner-v2/pages/page-shell';
import { BlogPostContent } from '@/components/templates/edgerunner-v2/pages/blog/blog-post-content';
import { getPostMetaBySlug, POST_SLUGS } from '@/components/templates/edgerunner-v2/pages/blog/post-data';
import { POST_CODE_BLOCKS } from '@/components/templates/edgerunner-v2/pages/blog/code-data';
import { highlightCode } from '@/lib/shiki-highlight';
import { subRouteRobots } from '@/lib/seo/public-metadata';
import { siteUrl } from '@/lib/url';
import type { PostCodeTokens } from '@/components/templates/edgerunner-v2/pages/blog/posts';

/** D-21 ISR backstop */
export const revalidate = 3600;

/** Allow on-demand ISR for usernames/slugs not pre-rendered at build time */
export const dynamicParams = true;

/**
 * Cartesian product of the seeded founder username × all 3 post slugs.
 * This ensures all 3 post pages are ● SSG at build time.
 */
export async function generateStaticParams(): Promise<
  { username: string; slug: string }[]
> {
  const usernames = ['jadrianports'];
  return usernames.flatMap((username) =>
    POST_SLUGS.map((slug) => ({ username, slug }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}): Promise<Metadata> {
  const { username, slug } = await params; // Next 16: params is a Promise — MUST await.

  const meta = getPostMetaBySlug(slug);
  if (!meta) {
    return { title: 'Not found', robots: { index: false, follow: false } };
  }

  const data = await getPortfolioByUsername(username);
  // D-14 gate: only a template whose spec opts into the 'blog' page renders posts.
  if (!data || !data.templateSpec.pages?.includes('blog')) {
    return { title: 'Not found', robots: { index: false, follow: false } };
  }

  const canonical = siteUrl(`/${username}/blog/${slug}`);

  return {
    title: `${meta.title} — ${data.profile.display_name ?? username}`,
    description: meta.excerpt,
    alternates: { canonical },
    // D-18: inherit the portfolio's isPublishReady noindex gate (no side-door).
    ...subRouteRobots(data),
    openGraph: {
      title: meta.title,
      description: meta.excerpt,
      url: canonical,
      type: 'article',
      images: [data.settings.og_image_url ?? siteUrl('/og-default.png')],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params; // Next 16: params is a Promise — MUST await.

  // Cookie-LESS anon read — keeps this route ISR-cacheable (D-22, Pitfall 2)
  const data = await getPortfolioByUsername(username);
  if (!data) notFound();

  // D-14 gate: 404 unless the resolved spec declares the 'blog' page.
  if (!data.templateSpec.pages?.includes('blog')) notFound();

  // GATE: unknown slug — use server-safe post-data.ts (no 'use client')
  const meta = getPostMetaBySlug(slug);
  if (!meta) notFound();

  // Pre-highlight all code blocks for this post using shiki (server, build
  // time for SSG).  Collect keys matching `${slug}/${index}` and build a
  // PostCodeTokens record keyed by block index string ("0", "1", ...).
  const codeTokens: PostCodeTokens = {};
  await Promise.all(
    Object.entries(POST_CODE_BLOCKS)
      .filter(([key]) => key.startsWith(`${slug}/`))
      .map(async ([key, { code, lang }]) => {
        const blockIndex = key.slice(slug.length + 1); // e.g. "0", "1"
        try {
          const result = await highlightCode(code, lang);
          codeTokens[blockIndex] = { lines: result.lines };
        } catch {
          // Highlighting failure is non-fatal — the CodeBlock falls back to
          // plain text children when tokens is undefined.
        }
      }),
  );

  // Pass slug + pre-highlighted tokens to the client component; it looks up
  // the full post (including the Body component) from posts.tsx at render time.
  return (
    <EdgerunnerV2PageShell data={data} activeNav="blog">
      <BlogPostContent slug={slug} username={username} codeTokens={codeTokens} />
    </EdgerunnerV2PageShell>
  );
}
