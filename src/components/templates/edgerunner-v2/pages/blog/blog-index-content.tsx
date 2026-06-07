'use client';
/**
 * edgerunner-v2 /blog list page content — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/routes/blog.index.tsx
 *
 * STATIC: posts are the hardcoded 3 posts from posts.tsx.
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout/sizing/typography Tailwind classes COPIED VERBATIM from export JSX.
 *   2. Color classes → inline style with scoped var(--token).
 *   3. Custom classes (font-display, font-mono-retro, text-glow-*, text-neon-*,
 *      shadow-neon-*) KEPT AS-IS (scoped in theme.css).
 *   4. framer-motion → motion/react with initial={false} for SSR visibility.
 *   5. TanStack <Link> → Next <Link href={...}>.
 *   6. 'use client' required for motion/react.
 */
import Link from 'next/link';
import { m } from 'motion/react';
import { ArrowRight, Calendar, Clock } from 'lucide-react';
import { SectionHeading } from '../../sections/ui/section-heading';
import { blogPosts } from './posts';
import type { Accent } from './post-data';

// ── Accent style maps ─────────────────────────────────────────────────────────

const accentBorderClass: Record<Accent, string> = {
  pink:   'border-neon-pink/40 hover:border-neon-pink hover:shadow-neon-pink',
  cyan:   'border-neon-cyan/40 hover:border-neon-cyan hover:shadow-neon-cyan',
  purple: 'border-neon-purple/40 hover:border-neon-purple hover:shadow-neon-purple',
};

// Can't use arbitrary Tailwind classes for these — use inline styles
const accentBorderHoverStyle: Record<Accent, React.CSSProperties> = {
  pink:   {},
  cyan:   {},
  purple: {},
};

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

// ── Component ─────────────────────────────────────────────────────────────────

export interface BlogIndexContentProps {
  username: string;
}

export function BlogIndexContent({ username }: BlogIndexContentProps) {
  return (
    <section className="relative mx-auto max-w-6xl px-6 pt-36 pb-24">
      <SectionHeading
        eyebrow="transmissions"
        title="Notes from the grid"
        description="Long-form essays on edge runtimes, motion design, and the craft of building software that feels alive."
        accent="cyan"
        align="left"
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {blogPosts.map((post, i) => (
          <m.div
            key={post.slug}
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
          >
            <Link
              href={`/${username}/blog/${post.slug}`}
              className="group block h-full rounded-xl border backdrop-blur transition-all"
              style={{
                ...accentCardBorderStyle[post.accent],
                background: 'color-mix(in srgb, var(--surface) 50%, transparent)',
              }}
            >
              {/* Tags */}
              <div className="p-6 pb-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  {post.tags.map((t) => (
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

                {/* Title */}
                <h3
                  className={`font-display text-xl font-bold leading-snug ${accentTextClass[post.accent]}`}
                >
                  {post.title}
                </h3>

                {/* Excerpt */}
                <p
                  className="mt-3 text-sm"
                  style={{ color: 'color-mix(in oklab, var(--fg) 75%, transparent)' }}
                >
                  {post.excerpt}
                </p>
              </div>

              {/* Footer: date + reading time + CTA */}
              <div className="px-6 pb-6">
                <div
                  className="mt-5 flex items-center justify-between border-t pt-4 text-xs"
                  style={{
                    borderColor: 'color-mix(in oklab, var(--border) 40%, transparent)',
                    color: 'var(--muted-fg)',
                  }}
                >
                  <span className="inline-flex items-center gap-1.5 font-mono-retro">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(post.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono-retro">
                    <Clock className="h-3.5 w-3.5" />
                    {post.readingTime}
                  </span>
                </div>

                <div
                  className={`mt-4 inline-flex items-center gap-2 font-mono-retro text-sm uppercase tracking-widest ${accentTextClass[post.accent]}`}
                >
                  Read post
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          </m.div>
        ))}
      </div>
    </section>
  );
}
