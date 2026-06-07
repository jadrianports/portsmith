'use client';
/**
 * BlogTeaser section — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/components/sections/BlogTeaser.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout/sizing/typography Tailwind classes COPIED VERBATIM from export JSX.
 *   2. Color/background/border Tailwind utilities converted to inline style or CSS vars:
 *        text-neon-pink/cyan/purple → style={{ color: 'var(--neon-ACCENT)' }}
 *        border-neon-ACCENT/40     → style={{ borderColor: 'color-mix(in oklab, var(--neon-ACCENT) 40%, transparent)' }}
 *        hover:border-neon-ACCENT  → .tmpl-blog-card-ACCENT (theme.css or kept as Tailwind custom class)
 *        bg-card/50 backdrop-blur  → style={{ background: 'color-mix(in srgb, var(--surface) 50%, transparent)', backdropFilter: 'blur(8px)' }}
 *        bg-background/40          → style={{ background: 'color-mix(in srgb, var(--bg) 40%, transparent)' }}
 *        border-border/60          → style={{ borderColor: 'color-mix(in oklab, var(--border) 60%, transparent)' }}
 *        text-muted-foreground     → style={{ color: 'var(--muted-fg)' }}
 *        text-foreground/75        → style={{ color: 'color-mix(in oklab, var(--fg) 75%, transparent)' }}
 *        border-border/40          → style={{ borderColor: 'color-mix(in oklab, var(--border) 40%, transparent)' }}
 *        border-neon-pink bg-neon-pink/10 shadow-neon-pink/40 → inline styles
 *   3. Custom classes (font-mono-retro, font-display, text-glow-*) KEPT AS-IS.
 *   4. framer-motion → motion/react. `initial={false}` (SSR-visible, no-JS-safety rule).
 *   5. DATA BINDING: BlogPreviewContent items (id/slug/title/excerpt/date/reading_time/tags/accent).
 *   6. Card link → Next <Link href={`/${username}/blog/${item.slug}`}> (blog post pages built next).
 *   7. "View all" CTA → /[username]/blog.
 *   8. 'use client' required for motion/react animations.
 */
import { m } from 'motion/react';
import Link from 'next/link';
import { ArrowRight, Calendar, Clock } from 'lucide-react';

import type { SectionProps } from './types';
import type { BlogPreviewContent } from '@/lib/validations';
import { SectionHeading } from './ui/section-heading';

type Accent = 'pink' | 'cyan' | 'purple';

// ── Per-accent token maps ─────────────────────────────────────────────────────

/** Card border color at rest (40% opacity) */
const accentBorderStyle: Record<Accent, string> = {
  pink: 'color-mix(in oklab, var(--neon-pink) 40%, transparent)',
  cyan: 'color-mix(in oklab, var(--neon-cyan) 40%, transparent)',
  purple: 'color-mix(in oklab, var(--neon-purple) 40%, transparent)',
};

/** Title text color (full opacity) */
const accentTitleStyle: Record<Accent, string> = {
  pink: 'var(--neon-pink)',
  cyan: 'var(--neon-cyan)',
  purple: 'var(--neon-purple)',
};

/** ─────────────────────────────────────────────────────────────────────────── */

export function BlogTeaser({
  section,
  username,
}: SectionProps & { username?: string | null }) {
  const content = (section?.content ?? null) as BlogPreviewContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items) ? content.items : [];
  if (items.length === 0) return null;

  const latest = items.slice(0, 3);
  const blogRoot = username ? `/${username}/blog` : '/blog';

  return (
    <section id="blog" className="relative mx-auto max-w-6xl px-6 py-24">
      <SectionHeading
        eyebrow="Transmissions"
        title={content.heading || 'Transmissions'}
        description="Long-form notes on edge runtimes, motion design, and the craft of building software that feels alive."
        accent="cyan"
      />

      <div className="grid gap-6 md:grid-cols-3">
        {latest.map((post, i) => {
          const accent: Accent =
            post.accent && ['pink', 'cyan', 'purple'].includes(post.accent)
              ? (post.accent as Accent)
              : (['pink', 'cyan', 'purple'] as Accent[])[i % 3];

          const postHref = username
            ? `/${username}/blog/${post.slug}`
            : `/blog/${post.slug}`;

          const displayDate = post.date
            ? (() => {
                try {
                  return new Date(post.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                } catch {
                  return post.date;
                }
              })()
            : null;

          return (
            <m.div
              key={post.id || post.slug}
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <Link
                href={postHref}
                className="group flex h-full flex-col rounded-xl border p-6 transition-all"
                style={{
                  borderColor: accentBorderStyle[accent],
                  background: 'color-mix(in srgb, var(--surface) 50%, transparent)',
                  backdropFilter: 'blur(8px)',
                  textDecoration: 'none',
                }}
              >
                {/* Tag pills — max 2, mono */}
                {Array.isArray(post.tags) && post.tags.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {post.tags.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="rounded-full font-mono-retro text-xs uppercase tracking-wider px-2.5 py-0.5"
                        style={{
                          border: '1px solid color-mix(in oklab, var(--border) 60%, transparent)',
                          background: 'color-mix(in srgb, var(--bg) 40%, transparent)',
                          color: 'var(--muted-fg)',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Title — font-display, accent color */}
                <h3
                  className="font-display text-lg font-bold leading-snug"
                  style={{ color: accentTitleStyle[accent] }}
                >
                  {post.title}
                </h3>

                {/* Excerpt */}
                {post.excerpt ? (
                  <p
                    className="mt-3 flex-1 text-sm"
                    style={{ color: 'color-mix(in oklab, var(--fg) 75%, transparent)' }}
                  >
                    {post.excerpt}
                  </p>
                ) : null}

                {/* Footer: date + reading time */}
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
                    ) : null}
                    {post.reading_time ? (
                      <span className="inline-flex items-center gap-1.5 font-mono-retro">
                        <Clock className="h-3.5 w-3.5" />
                        {post.reading_time}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </Link>
            </m.div>
          );
        })}
      </div>

      {/* "View all posts" CTA — links to /[username]/blog */}
      <div className="mt-10 flex justify-center">
        <Link
          href={blogRoot}
          className="group inline-flex items-center gap-3 rounded-md font-mono-retro text-sm uppercase tracking-widest px-6 py-3 transition-all"
          style={{
            border: '1px solid var(--neon-pink)',
            background: 'color-mix(in oklab, var(--neon-pink) 10%, transparent)',
            color: 'var(--neon-pink)',
            boxShadow: '0 0 20px -8px color-mix(in oklab, var(--neon-pink) 40%, transparent)',
            textDecoration: 'none',
          }}
        >
          View all posts
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
