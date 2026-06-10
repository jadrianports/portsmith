/**
 * `buildBlogPostingLd` — the pure schema.org `BlogPosting` JSON-LD builder for a
 * published blog post (SEO rich-results for articles; the post-page analog of
 * `buildPersonLd`).
 *
 * PURE — no I/O, no DB, no request access. Reads the already-assembled
 * `PublishedPost` (the cookie-less `public_blog_posts` view row + derived reading
 * time) plus the post's `PortfolioData` for author/name/image. Rendered server-side
 * via `<JsonLd html={blogPostingLdScriptHtml(...)} />` so it lands in the static ISR
 * HTML (crawlable) with react-markdown still OFF the client bundle (D-25).
 *
 * LOAD-BEARING (PUB-03 / D-22): every URL (`url`, `mainEntityOfPage`, `author.url`)
 * is derived from `siteUrl()` (`NEXT_PUBLIC_SITE_URL`), NEVER the request host — same
 * host-safety contract as `person-jsonld.ts`.
 *
 * SECURITY: serialize ONLY via `jsonLdToScriptHtml` (reused from `person-jsonld.ts`)
 * — `headline`/`description`/`keywords`/`author.name` are user-controlled free text,
 * so raw `JSON.stringify` into a `<script>` body would be a stored-XSS hole.
 *
 * OPTIONAL FIELDS are omitted (never emitted empty): `description` only with an
 * excerpt; `datePublished`/`dateModified` only with a date; `image` only with a
 * configured OG image; `keywords` only with tags.
 */
import type { PortfolioData } from '@/components/templates/types';
import type { PublishedPost } from '@/lib/portfolio/get-posts';
import { jsonLdToScriptHtml } from '@/lib/seo/person-jsonld';
import { siteUrl } from '@/lib/url';

/** The schema.org `BlogPosting` shape this builder emits (optional fields omitted). */
export interface BlogPostingLd {
  '@context': 'https://schema.org';
  '@type': 'BlogPosting';
  headline: string;
  url: string;
  mainEntityOfPage: string;
  author: { '@type': 'Person'; name: string; url: string };
  datePublished?: string;
  dateModified?: string;
  description?: string;
  image?: string;
  keywords?: string;
}

/**
 * Build the `BlogPosting` JSON-LD for one published post. PURE. `datePublished`
 * prefers the author-controlled `display_date` (D-05), falling back to the real
 * `published_at`; `dateModified` uses `published_at` when available.
 */
export function buildBlogPostingLd(
  post: PublishedPost,
  data: PortfolioData,
  username: string,
): BlogPostingLd {
  const slug = post.slug ?? '';
  const canonical = siteUrl(`/${username}/blog/${slug}`);
  const name = data.profile.display_name ?? username;
  const published = post.display_date ?? post.published_at ?? undefined;
  const modified = post.published_at ?? published;
  const image = data.settings.og_image_url ?? undefined;
  const tags = Array.isArray(post.tags)
    ? post.tags.filter((t): t is string => typeof t === 'string' && t.length > 0)
    : [];

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title ?? 'Untitled',
    url: canonical,
    mainEntityOfPage: canonical,
    author: { '@type': 'Person', name, url: siteUrl(`/${username}`) },
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
    ...(post.excerpt ? { description: post.excerpt } : {}),
    ...(image ? { image } : {}),
    ...(tags.length ? { keywords: tags.join(', ') } : {}),
  };
}

/**
 * Build the `BlogPosting` JSON-LD AND serialize it XSS-safely for a `<script>` body
 * in one call — the path the post route uses via `<JsonLd html={...} />`.
 */
export function blogPostingLdScriptHtml(
  post: PublishedPost,
  data: PortfolioData,
  username: string,
): string {
  return jsonLdToScriptHtml(buildBlogPostingLd(post, data, username));
}
