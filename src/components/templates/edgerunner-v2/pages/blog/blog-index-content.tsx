'use client';
/**
 * edgerunner-v2 /blog list page content — the synthwave card grid, now DATA-DRIVEN.
 *
 * DATA (13.2-05 / D-08/D-17): posts come from the DB via `getPublishedPosts` (the
 * cookie-less `public_blog_posts` read), passed in as the `posts` prop by the server
 * route. The static `posts.tsx`/`post-data.ts` import is GONE — posts are data now.
 *
 * ACCENT (D-06): pink/cyan/purple is template DECORATION cycled BY INDEX here, NOT a
 * stored field. Every DB field is null-guarded (the all-nullable view-Row rule).
 *
 * TRANSCRIPTION RULES (preserved from the original):
 *   1. Layout/sizing/typography Tailwind classes KEPT VERBATIM.
 *   2. Color → inline style with scoped var(--token).
 *   3. Custom classes (font-display, font-mono-retro, text-neon-*) KEPT AS-IS.
 *   4. framer-motion → motion/react with initial={false} for SSR visibility.
 *   5. Next <Link href={...}>.
 *   6. 'use client' required for motion/react.
 */
import Link from 'next/link';
import { m } from 'motion/react';
import { ArrowRight, Calendar, Clock } from 'lucide-react';
import { SectionHeading } from '../../sections/ui/section-heading';
import type { PublishedPost } from '@/lib/portfolio/get-posts';

// ── Accent style maps (decoration, cycled by index — D-06) ──────────────────────

/** Template decoration accent (D-06) — local union; the static post-data source is gone (D-17). */
type Accent = 'pink' | 'cyan' | 'purple';

const ACCENT_CYCLE: readonly Accent[] = ['pink', 'cyan', 'purple'];

const accentCardBorderStyle: Record<Accent, React.CSSProperties> = {
  pink:   { borderColor: 'color-mix(in oklab, var(--neon-pink) 40%, transparent)' },
  cyan:   { borderColor: 'color-mix(in oklab, var(--neon-cyan) 40%, transparent)' },
  purple: { borderColor: 'color-mix(in oklab, var(--neon-purple) 40%, transparent)' },
};

const accentTextClass: Record<Accent, string> = {
  pink:   'text-neon-pink',
  cyan:   'text-neon-cyan',
  purple: 'text-neon-purple',
};

/** Format an ISO `display_date` to "Mon D, YYYY"; null/invalid → null. */
function formatDate(date: string | null): string | null {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface BlogIndexContentProps {
  username: string;
  /** Published posts (newest-first) from the cookie-less DB read. */
  posts: PublishedPost[];
}

export function BlogIndexContent({ username, posts }: BlogIndexContentProps) {
  return (
    <section className="relative mx-auto max-w-6xl px-6 pt-36 pb-24">
      <SectionHeading
        eyebrow="transmissions"
        title="Notes from the grid"
        description="Long-form essays on edge runtimes, motion design, and the craft of building software that feels alive."
        accent="cyan"
        align="left"
      />

      {posts.length === 0 ? (
        <p
          className="mt-8 font-mono-retro text-sm uppercase tracking-widest"
          style={{ color: 'var(--muted-fg)' }}
        >
          // no transmissions yet
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => {
            // Accent is decoration cycled by index (D-06), not a stored field.
            const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
            const slug = post.slug ?? '';
            const tags = Array.isArray(post.tags) ? post.tags : [];
            const displayDate = formatDate(post.display_date);
            return (
              <m.div
                key={post.id ?? slug}
                initial={false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <Link
                  href={`/${username}/blog/${slug}`}
                  className="group block h-full rounded-xl border backdrop-blur transition-all"
                  style={{
                    ...accentCardBorderStyle[accent],
                    background: 'color-mix(in srgb, var(--surface) 50%, transparent)',
                  }}
                >
                  {/* Tags */}
                  <div className="p-6 pb-0">
                    {tags.length > 0 ? (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full font-mono-retro text-xs uppercase tracking-wider"
                            style={{
                              border: '1px solid color-mix(in oklab, var(--border) 60%, transparent)',
                              background: 'color-mix(in srgb, var(--bg) 40%, transparent)',
                              color: 'var(--muted-fg)',
                              padding: '0.125rem 0.625rem',
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {/* Title */}
                    <h3
                      className={`font-display text-xl font-bold leading-snug ${accentTextClass[accent]}`}
                    >
                      {post.title ?? 'Untitled'}
                    </h3>

                    {/* Excerpt */}
                    {post.excerpt ? (
                      <p
                        className="mt-3 text-sm"
                        style={{ color: 'color-mix(in oklab, var(--fg) 75%, transparent)' }}
                      >
                        {post.excerpt}
                      </p>
                    ) : null}
                  </div>

                  {/* Footer: date + reading time + CTA */}
                  <div className="px-6 pb-6">
                    {(displayDate || post.reading_time) ? (
                      <div
                        className="mt-5 flex items-center justify-between border-t pt-4 text-xs"
                        style={{
                          borderColor: 'color-mix(in oklab, var(--border) 40%, transparent)',
                          color: 'var(--muted-fg)',
                        }}
                      >
                        {displayDate ? (
                          <span className="inline-flex items-center gap-1.5 font-mono-retro">
                            <Calendar className="h-3.5 w-3.5" />
                            {displayDate}
                          </span>
                        ) : <span />}
                        {post.reading_time ? (
                          <span className="inline-flex items-center gap-1.5 font-mono-retro">
                            <Clock className="h-3.5 w-3.5" />
                            {post.reading_time}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <div
                      className={`mt-4 inline-flex items-center gap-2 font-mono-retro text-sm uppercase tracking-widest ${accentTextClass[accent]}`}
                    >
                      Read post
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              </m.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
