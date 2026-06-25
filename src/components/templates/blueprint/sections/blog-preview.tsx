/**
 * Blog Preview section (blueprint section 12) — FAITHFUL clone of the export's
 * `BlogPreview.tsx`: a 3-column grid of "// NOTES_FROM_BENCH" teaser cards (each lifts + gains
 * an accent border on hover, title brightens to accent), with a date · reading-time mono line,
 * excerpt, accent tag pills, then an "All notes →" link to the dedicated blog index.
 *
 * DATA (D-16): `recentPosts` (the real published posts) is the PRIMARY source; the legacy
 * `content.items[]` is the fallback. Cards link to `/{username}/blog/{slug}`; "All notes" →
 * `/{username}/blog`. `username` + `recentPosts` are threaded by `index.tsx`.
 */
import Link from 'next/link';

import type { SectionProps } from './types';
import type { BlogPreviewContent } from '@/lib/validations';
import type { PublicPost } from '../../types';
import { readingTimeFromMarkdown } from '@/lib/markdown/reading-time';
import { MonoPill, SectionShell, formatDate, present } from './shared';

interface TeaserTile {
  key: string;
  slug: string;
  title: string;
  excerpt: string | null;
  date: string | null;
  reading_time: string | null;
  tags: string[];
}

export function BlogPreview({
  section,
  username,
  recentPosts,
}: SectionProps & { username?: string | null; recentPosts?: PublicPost[] }) {
  const content = (section?.content ?? null) as BlogPreviewContent | null;

  const dbPosts = Array.isArray(recentPosts) ? recentPosts : [];
  let tiles: TeaserTile[];
  if (dbPosts.length > 0) {
    tiles = dbPosts.slice(0, 3).map((p) => ({
      key: p.id ?? p.slug ?? '',
      slug: p.slug ?? '',
      title: p.title ?? 'Untitled',
      excerpt: p.excerpt,
      date: p.display_date,
      reading_time: p.body_md ? readingTimeFromMarkdown(p.body_md) : null,
      tags: Array.isArray(p.tags) ? p.tags : [],
    }));
  } else {
    const items = content && Array.isArray(content.items) ? content.items : [];
    tiles = items.slice(0, 3).map((post) => ({
      key: post.id || post.slug,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt ?? null,
      date: post.date ?? null,
      reading_time: post.reading_time ?? null,
      tags: Array.isArray(post.tags) ? post.tags : [],
    }));
  }

  if (tiles.length === 0) return null;

  const heading = present(content?.heading) ? (content!.heading as string) : 'Notes from the bench';
  const blogRoot = username ? `/${username}/blog` : '/blog';

  return (
    <SectionShell id="blog" channel="CH13" eyebrow="// NOTES_FROM_BENCH" heading={heading}>
      <div className="grid gap-6 md:grid-cols-3">
        {tiles.map((post) => {
          const postHref = username ? `/${username}/blog/${post.slug}` : `/blog/${post.slug}`;
          return (
            <Link
              key={post.key}
              href={postHref}
              className="bp-card group block h-full p-6 md:p-7 border rounded-md"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', textDecoration: 'none' }}
            >
              {post.date || post.reading_time ? (
                <div
                  className="bp-mono flex items-center gap-3 text-[10px] tracking-wider uppercase"
                  style={{ color: 'var(--muted-fg)' }}
                >
                  {post.date ? <time dateTime={post.date}>{formatDate(post.date)}</time> : null}
                  {post.reading_time ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>{post.reading_time}</span>
                    </>
                  ) : null}
                </div>
              ) : null}
              <h3 className="bp-card-title mt-3 text-lg md:text-xl font-semibold tracking-tight" style={{ color: 'var(--fg)' }}>
                {post.title}
              </h3>
              {post.excerpt ? (
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted-fg)' }}>
                  {post.excerpt}
                </p>
              ) : null}
              {post.tags.length ? (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {post.tags.slice(0, 6).map((t) => (
                    <MonoPill key={t} variant="accent">
                      {t}
                    </MonoPill>
                  ))}
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>
      <div className="mt-10">
        <Link
          href={blogRoot}
          className="bp-link bp-mono inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase underline-offset-4 hover:underline"
          style={{ color: 'var(--accent-text)' }}
        >
          All notes →
        </Link>
      </div>
    </SectionShell>
  );
}
