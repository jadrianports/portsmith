'use client';
/**
 * edgerunner-v2 /blog/[slug] post page content — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/routes/blog.$slug.tsx
 *
 * Receives `slug` from the server page (which validated it via post-data.ts).
 * Looks up the full post (including the Body component) from posts.tsx at
 * render time — this is safe because posts.tsx is also 'use client'.
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout/sizing/typography classes COPIED VERBATIM from export JSX.
 *   2. Color classes → inline style with scoped var(--token).
 *   3. Custom classes (font-display, font-mono-retro, text-glow-*, text-neon-*,
 *      shadow-neon-*, bg-gradient-neon) KEPT AS-IS (scoped in theme.css).
 *   4. framer-motion → motion/react with initial={false} for SSR visibility.
 *   5. TanStack <Link> → Next <Link href={...}>.
 *   6. 'use client' required for motion/react + Body components.
 */
import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { blogPosts, type Accent } from './posts';

const accentTextClass: Record<Accent, string> = {
  pink:   'text-neon-pink text-glow-pink',
  cyan:   'text-neon-cyan text-glow-cyan',
  purple: 'text-neon-purple text-glow-purple',
};

// ── Component ─────────────────────────────────────────────────────────────────

export interface BlogPostContentProps {
  slug: string;
  username: string;
}

export function BlogPostContent({ slug, username }: BlogPostContentProps) {
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return null; // Should never happen — server already gated.

  const Body = post.Body;
  const others = blogPosts.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <article className="relative mx-auto max-w-3xl px-6 pt-36 pb-24">
      {/* Back link */}
      <Link
        href={`/${username}/blog`}
        className="inline-flex items-center gap-2 font-mono-retro text-sm uppercase tracking-widest text-neon-cyan hover:text-glow-cyan"
      >
        <ArrowLeft className="h-4 w-4" /> All posts
      </Link>

      {/* Header */}
      <motion.header
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mt-6"
      >
        {/* Tags */}
        <div className="mb-4 flex flex-wrap gap-2">
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
        <h1
          className={`font-display text-4xl font-black uppercase leading-tight sm:text-5xl ${accentTextClass[post.accent]}`}
        >
          {post.title}
        </h1>

        {/* Date + reading time */}
        <div
          className="mt-5 flex flex-wrap gap-4 font-mono-retro text-sm"
          style={{ color: 'var(--muted-fg)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {new Date(post.date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {post.readingTime}
          </span>
        </div>
      </motion.header>

      {/* Neon gradient divider */}
      <div className="my-10 h-px bg-gradient-neon" />

      {/* Post body */}
      <motion.div
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="prose-blog"
      >
        <Body />
      </motion.div>

      {/* Keep reading */}
      {others.length > 0 && (
        <section
          className="mt-20 border-t pt-10"
          style={{ borderColor: 'color-mix(in oklab, var(--border) 40%, transparent)' }}
        >
          <h3
            className="font-mono-retro text-sm uppercase tracking-[0.4em]"
            style={{ color: 'color-mix(in oklab, var(--neon-cyan) 80%, transparent)' }}
          >
            // keep reading
          </h3>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {others.map((o) => (
              <Link
                key={o.slug}
                href={`/${username}/blog/${o.slug}`}
                className="group rounded-lg p-4 backdrop-blur transition-all"
                style={{
                  border: '1px solid color-mix(in oklab, var(--border) 60%, transparent)',
                  background: 'color-mix(in srgb, var(--surface) 40%, transparent)',
                }}
              >
                <div className={`font-display text-base font-bold ${accentTextClass[o.accent]}`}>
                  {o.title}
                </div>
                <p
                  className="mt-2 text-sm"
                  style={{ color: 'var(--muted-fg)' }}
                >
                  {o.excerpt}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
