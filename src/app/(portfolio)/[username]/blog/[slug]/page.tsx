/**
 * edgerunner-v2 dedicated /blog/[slug] post page — `/${username}/blog/${slug}`.
 *
 * STATIC / ISR (D-22): cookie-less anon data fetch, `revalidate=3600`,
 * `generateStaticParams` enumerating the founder's published post slugs (Pattern 2)
 * so they are prerendered as ● SSG; `dynamicParams = true` covers every other
 * user/post on-demand. No cookies()/headers()/host-reads.
 *
 * GATE (D-14): if the resolved spec's `pages` does NOT include `'blog'` → notFound().
 *       if there is no published post at `(portfolioId, slug)` → notFound().
 *
 * NEXT 16 ASYNC PARAMS: `params` is a Promise — MUST be `await`ed.
 *
 * DB-MARKDOWN ENGINE (13.2-03/05 / D-08/D-09): the post body is `post.body_md`
 * (Markdown from `public_blog_posts`) rendered SERVER-SIDE through the single
 * `MarkdownRenderer` pipeline — the SAME pipeline the CMS preview action uses, so a
 * preview can never lie (D-20). The renderer pre-highlights fenced code itself via
 * the Shiki code-bridge (no page-level POST_CODE_BLOCKS loop). The rendered element
 * is passed as a `body` slot into the `'use client'` content shell (Next 16 server-
 * in-client slot pattern) — the body is rendered on the server ahead of time and
 * threaded as an RSC reference, keeping react-markdown OFF the First Load JS (D-25).
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getPortfolioByUsername } from '@/lib/portfolio/get-portfolio';
import { redirectIfRenamedHandle } from '@/lib/portfolio/username-redirect';
import {
  getPublishedPostBySlug,
  getPublishedPosts,
  getPublishedPostSlugs,
} from '@/lib/portfolio/get-posts';
import { MarkdownRenderer } from '@/lib/markdown/render-markdown';
import { EdgerunnerV2PageShell } from '@/components/templates/edgerunner-v2/pages/page-shell';
import {
  BlogPostContent,
  type KeepReadingItem,
} from '@/components/templates/edgerunner-v2/pages/blog/blog-post-content';
import { BlueprintPageShell } from '@/components/templates/blueprint/pages/page-shell';
import { BlueprintBlogPostContent } from '@/components/templates/blueprint/pages/blog/blog-post-content';
import { blueprintProseComponents } from '@/components/templates/blueprint/pages/blog/prose';
import { subRouteRobots, resolveFaviconIcons } from '@/lib/seo/public-metadata';
import { shareImageUrl } from '@/lib/og/og-image-url';
import { blogPostingLdScriptHtml } from '@/lib/seo/blogposting-jsonld';
import { JsonLd } from '@/lib/seo/json-ld';
import { siteUrl } from '@/lib/url';

/** D-21 ISR backstop */
export const revalidate = 3600;

/** Allow on-demand ISR for usernames/slugs not pre-rendered at build time */
export const dynamicParams = true;

/**
 * Prerender the founder's published post slugs at build (Pattern 2 — cookie-less
 * anon read). Everyone else is on-demand ISR via `dynamicParams = true` (D-15:
 * sub-pages are exclusive-lane; non-edgerunner users 404 at the spec gate anyway).
 */
export async function generateStaticParams(): Promise<
  { username: string; slug: string }[]
> {
  const username = 'jadrianports';
  const slugs = await getPublishedPostSlugs(username);
  return slugs.map((slug) => ({ username, slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}): Promise<Metadata> {
  const { username, slug } = await params; // Next 16: params is a Promise — MUST await.

  const data = await getPortfolioByUsername(username);
  // D-14 gate: only a template whose spec opts into the 'blog' page renders posts.
  if (!data || !data.templateSpec.pages?.includes('blog')) {
    return { title: 'Not found', robots: { index: false, follow: false } };
  }

  // DB post lookup (cookie-less). A missing/unpublished post → not-found metadata.
  const post = data.portfolioId
    ? await getPublishedPostBySlug(data.portfolioId, slug)
    : null;
  if (!post) {
    return { title: 'Not found', robots: { index: false, follow: false } };
  }

  const canonical = siteUrl(`/${username}/blog/${slug}`);
  const title = post.title ?? 'Untitled';
  const description = post.excerpt ?? undefined;

  return {
    title: `${title} — ${data.profile.display_name ?? username}`,
    description,
    alternates: { canonical },
    // D-18: inherit the portfolio's isPublishReady noindex gate (no side-door).
    ...subRouteRobots(data),
    // META-03 / D-03: the favicon reaches this sub-route too (inline builder — Pitfall 2).
    ...resolveFaviconIcons(data, username),
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'article',
      // og:type=article sub-properties — the author-controlled publish date (D-05,
      // falling back to published_at), the author, and the post tags for richer
      // article/social unfurls.
      ...(post.display_date ?? post.published_at
        ? { publishedTime: (post.display_date ?? post.published_at) as string }
        : {}),
      authors: [data.profile.display_name ?? username],
      ...(Array.isArray(post.tags) && post.tags.length > 0
        ? { tags: post.tags.filter((t): t is string => typeof t === 'string' && t.length > 0) }
        : {}),
      // META-04 / Pitfall 4 — uniform shareImageUrl ladder (override → dynamic card),
      // matching the other three routes; a saved-empty og_image_url falls through (no
      // og:image:['']) instead of pinning the static default share image.
      images: [shareImageUrl(username, data.settings.og_image_url)],
    },
    // Twitter/X large-image card — controls the link unfurl + CTR.
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      // META-04 / Pitfall 4 — uniform shareImageUrl ladder (same resolved card).
      images: [shareImageUrl(username, data.settings.og_image_url)],
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
  if (!data) {
    await redirectIfRenamedHandle(username, '/blog/' + slug); // HANDLE-02 — preserve sub-path (D-03)
    notFound();
  }

  // D-14 gate: 404 unless the resolved spec declares the 'blog' page.
  if (!data.templateSpec.pages?.includes('blog')) notFound();

  // DB post + sibling posts (cookie-less). Missing/unpublished post → notFound().
  const portfolioId = data.portfolioId;
  if (!portfolioId) notFound();
  const post = await getPublishedPostBySlug(portfolioId, slug);
  if (!post) notFound();

  // Per-template blog UI dispatch (additive — edgerunner-v2 stays the default path below).
  if (data.templateSlug === 'blueprint') {
    const brand = (data.profile.display_name ?? data.profile.username ?? username).trim();
    // Blueprint's OWN engineering-bench prose primitives drive the shared markdown pipeline.
    const bpBody = <MarkdownRenderer source={post.body_md ?? ''} components={blueprintProseComponents} />;
    return (
      <>
        <JsonLd html={blogPostingLdScriptHtml(post, data, username)} />
        <BlueprintPageShell data={data}>
          <BlueprintBlogPostContent
            username={username}
            brand={brand}
            slug={slug}
            title={post.title ?? 'Untitled'}
            tags={Array.isArray(post.tags) ? post.tags.filter((t): t is string => typeof t === 'string') : []}
            displayDate={post.display_date}
            readingTime={post.reading_time}
            body={bpBody}
          />
        </BlueprintPageShell>
      </>
    );
  }

  // Render the Markdown body SERVER-SIDE through the single shared pipeline (D-09).
  // The element is threaded into the client shell as a slot (server-in-client).
  const body = <MarkdownRenderer source={post.body_md ?? ''} />;

  // "Keep reading" — up to 2 OTHER published posts (accent cycled by index — D-06).
  const ACCENT_CYCLE = ['pink', 'cyan', 'purple'] as const;
  const others: KeepReadingItem[] = (await getPublishedPosts(portfolioId))
    .filter((p) => p.slug && p.slug !== slug)
    .slice(0, 2)
    .map((p, i) => ({
      slug: p.slug ?? '',
      title: p.title ?? 'Untitled',
      excerpt: p.excerpt,
      accent: ACCENT_CYCLE[i % ACCENT_CYCLE.length],
    }));

  return (
    <>
      {/* schema.org BlogPosting rich-results data — server-rendered into the static
          ISR HTML. Rendered via <JsonLd> (escaped serializer) outside the markdown
          render path so the no-dsih gate stays intact. */}
      <JsonLd html={blogPostingLdScriptHtml(post, data, username)} />
      <EdgerunnerV2PageShell data={data} activeNav="blog">
        <BlogPostContent
          username={username}
          title={post.title ?? 'Untitled'}
          tags={Array.isArray(post.tags) ? post.tags : []}
          displayDate={post.display_date}
          readingTime={post.reading_time}
          others={others}
          body={body}
        />
      </EdgerunnerV2PageShell>
    </>
  );
}
