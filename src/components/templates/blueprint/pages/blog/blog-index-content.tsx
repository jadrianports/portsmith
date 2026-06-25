/**
 * Blueprint /blog list content — a FAITHFUL transcription of the export's `blog.index.tsx`: a
 * minimal hairline-bottom header (← handle mark + `/blog` tag), a `// ARCHIVE` eyebrow, the
 * oversized title, and a hairline-separated archive list ([date | title+excerpt+tags | Read →]).
 * SERVER COMPONENT (the export's framer-motion `Reveal`s are dropped — static render).
 *
 * DATA (D-08/D-17): posts come from the DB via `getPublishedPosts` (cookie-less), passed as the
 * `posts` prop by the server route. The persona intro line is dropped (invented content); the
 * title comes from the blog_preview section heading when present (real data), else a neutral
 * default. Every field null-guarded.
 */
import Link from 'next/link';

import type { PublishedPost } from '@/lib/portfolio/get-posts';
import { Eyebrow, MonoPill, formatDate, present } from '../../sections/shared';

export interface BlueprintBlogIndexProps {
  username: string;
  /** Display mark in the header (handle/name). */
  brand: string;
  /** The list title (from the blog_preview heading, else neutral). */
  heading: string;
  /** Published posts (newest-first) from the cookie-less DB read. */
  posts: PublishedPost[];
}

export function BlueprintBlogIndexContent({ username, brand, heading, posts }: BlueprintBlogIndexProps) {
  return (
    <>
      <header className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-[1100px] px-6 py-5 flex justify-between items-center">
          <Link
            href={`/${username}`}
            className="bp-link bp-mono text-xs tracking-[0.2em] uppercase"
            style={{ color: 'var(--fg)' }}
          >
            <span style={{ color: 'var(--accent)' }}>←</span> {brand}
          </Link>
          <span className="bp-mono text-[10px] tracking-wider uppercase" style={{ color: 'var(--muted-fg)' }}>
            /blog
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-6 py-20 md:py-28">
        <Eyebrow channel="CH13">// ARCHIVE</Eyebrow>
        <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight">{heading}</h1>

        {posts.length === 0 ? (
          <p className="bp-mono mt-8 text-sm uppercase tracking-widest" style={{ color: 'var(--muted-fg)' }}>
            // no entries yet
          </p>
        ) : (
          <ul
            className="mt-16 space-y-px border rounded-md overflow-hidden"
            style={{ backgroundColor: 'var(--border)', borderColor: 'var(--border)' }}
          >
            {posts.map((post) => {
              const slug = post.slug ?? '';
              const tags = Array.isArray(post.tags) ? post.tags.filter((t): t is string => present(t)) : [];
              return (
                <li key={post.id ?? slug} style={{ backgroundColor: 'var(--bg)' }}>
                  <Link
                    href={`/${username}/blog/${slug}`}
                    className="bp-card-title group block p-6 md:p-8"
                    style={{ textDecoration: 'none' }}
                  >
                    <div className="grid md:grid-cols-[180px_1fr_120px] gap-4 md:gap-8 items-start">
                      <div className="bp-mono text-[11px] tracking-wider uppercase" style={{ color: 'var(--muted-fg)' }}>
                        {present(post.display_date) ? (
                          <time dateTime={post.display_date}>{formatDate(post.display_date)}</time>
                        ) : null}
                        {present(post.reading_time) ? (
                          <div className="mt-1" style={{ color: 'color-mix(in srgb, var(--muted-fg) 70%, transparent)' }}>
                            {post.reading_time}
                          </div>
                        ) : null}
                      </div>
                      <div>
                        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{post.title ?? 'Untitled'}</h2>
                        {present(post.excerpt) ? (
                          <p className="mt-2 leading-relaxed" style={{ color: 'var(--muted-fg)' }}>
                            {post.excerpt}
                          </p>
                        ) : null}
                        {tags.length ? (
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {tags.map((t) => (
                              <MonoPill key={t} variant="accent">
                                {t}
                              </MonoPill>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="bp-mono hidden md:flex justify-end items-center text-sm" style={{ color: 'var(--accent)' }}>
                        Read →
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
