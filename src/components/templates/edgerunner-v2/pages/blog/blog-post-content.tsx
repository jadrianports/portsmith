'use client';
/**
 * edgerunner-v2 /blog/[slug] post page content — the synthwave article shell, now
 * DATA-DRIVEN + ENGINE-RENDERED.
 *
 * DATA (13.2-05 / D-08/D-17): the title/tags/date/reading-time come from the DB post
 * (passed as props by the server route); the body is the SERVER-RENDERED Markdown
 * element from the single `MarkdownRenderer` pipeline (D-09), passed in as the `body`
 * slot (server-in-client — react-markdown never enters this client island, D-25).
 * The static `posts.tsx` lookup + the per-block `codeTokens` plumbing are GONE — the
 * renderer pre-highlights fenced code itself via the Shiki code-bridge.
 *
 * ACCENT (D-06): pink/cyan/purple is template decoration; the header uses the brand
 * cyan, the "keep reading" cards cycle by index (set on the route).
 *
 * TRANSCRIPTION RULES (preserved): layout/typography classes verbatim; color → scoped
 * var(--token); custom classes (font-display, font-mono-retro, text-glow-*, text-neon-*,
 * bg-gradient-neon) kept; framer-motion → motion/react with initial={false}.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { m } from 'motion/react';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';

/** Template decoration accent (D-06) — local union; the static post-data source is gone (D-17). */
type Accent = 'pink' | 'cyan' | 'purple';

const accentTextClass: Record<Accent, string> = {
  pink:   'text-neon-pink text-glow-pink',
  cyan:   'text-neon-cyan text-glow-cyan',
  purple: 'text-neon-purple text-glow-purple',
};

/** One "keep reading" card — a sibling published post (accent cycled by index). */
export interface KeepReadingItem {
  slug: string;
  title: string;
  excerpt: string | null;
  accent: Accent;
}

export interface BlogPostContentProps {
  username: string;
  title: string;
  tags: string[];
  /** ISO `display_date` (`| null`). */
  displayDate: string | null;
  /** Derived reading time (e.g. "8 min"), or null. */
  readingTime: string | null;
  /** Up to 2 other published posts for the "keep reading" rail. */
  others: KeepReadingItem[];
  /** The server-rendered Markdown body element (slot). */
  body: ReactNode;
}

/** Format an ISO date to "Month D, YYYY"; null/invalid → null. */
function formatDate(date: string | null): string | null {
  if (!date) return null;
  try {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

export function BlogPostContent({
  username,
  title,
  tags,
  displayDate,
  readingTime,
  others,
  body,
}: BlogPostContentProps) {
  // Header accent — brand cyan (decoration, not stored — D-06).
  const headerAccent: Accent = 'cyan';
  const formattedDate = formatDate(displayDate);

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
      <m.header
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mt-6"
      >
        {/* Tags */}
        {tags.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
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
        <h1
          className={`font-display text-4xl font-black uppercase leading-tight sm:text-5xl ${accentTextClass[headerAccent]}`}
        >
          {title}
        </h1>

        {/* Date + reading time */}
        {(formattedDate || readingTime) ? (
          <div
            className="mt-5 flex flex-wrap gap-4 font-mono-retro text-sm"
            style={{ color: 'var(--muted-fg)' }}
          >
            {formattedDate ? (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {formattedDate}
              </span>
            ) : null}
            {readingTime ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {readingTime}
              </span>
            ) : null}
          </div>
        ) : null}
      </m.header>

      {/* Neon gradient divider */}
      <div className="my-10 h-px bg-gradient-neon" />

      {/* Post body — server-rendered Markdown element (slot) */}
      <m.div
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="prose-blog"
      >
        {body}
      </m.div>

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
                {o.excerpt ? (
                  <p
                    className="mt-2 text-sm"
                    style={{ color: 'var(--muted-fg)' }}
                  >
                    {o.excerpt}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
