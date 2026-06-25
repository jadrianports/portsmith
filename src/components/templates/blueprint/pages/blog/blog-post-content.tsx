/**
 * Blueprint /blog/[slug] post content — a FAITHFUL transcription of the export's
 * `blog.$slug.tsx`: a minimal hairline-bottom header (← all notes + handle), a `// slug` mono
 * tag, the oversized title, a mono date · reading-time line, accent tag pills, a hairline rule,
 * the rendered Markdown body (a server-rendered slot from the shared pipeline, styled with
 * blueprint's prose primitives), then a back link. SERVER COMPONENT (no `'use client'`).
 *
 * DATA (D-08/D-09): title/tags/date/reading-time from the DB post (props); the body is the
 * server-rendered Markdown element passed as the `body` slot. Every field null-guarded.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';

import { MonoPill, formatDate, present } from '../../sections/shared';

export interface BlueprintBlogPostProps {
  username: string;
  brand: string;
  slug: string;
  title: string;
  tags: string[];
  displayDate: string | null;
  readingTime: string | null;
  /** The server-rendered Markdown body element (slot). */
  body: ReactNode;
}

export function BlueprintBlogPostContent({
  username,
  brand,
  slug,
  title,
  tags,
  displayDate,
  readingTime,
  body,
}: BlueprintBlogPostProps) {
  return (
    <>
      <header className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-[1100px] px-6 py-5 flex justify-between items-center">
          <Link
            href={`/${username}/blog`}
            className="bp-link bp-mono text-xs tracking-[0.2em] uppercase"
            style={{ color: 'var(--fg)' }}
          >
            <span style={{ color: 'var(--accent-text)' }}>←</span> all notes
          </Link>
          <Link
            href={`/${username}`}
            className="bp-link-muted bp-mono text-[10px] tracking-wider uppercase"
            style={{ color: 'var(--muted-fg)' }}
          >
            {brand}
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-[760px] px-6 py-16 md:py-24">
        <div className="bp-mono text-[11px] tracking-[0.18em] uppercase flex items-center gap-3">
          <span style={{ color: 'var(--accent-text)' }}>// {slug}</span>
        </div>
        <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">{title}</h1>
        {present(displayDate) || present(readingTime) ? (
          <div
            className="bp-mono mt-6 flex flex-wrap items-center gap-4 text-[11px] tracking-wider uppercase"
            style={{ color: 'var(--muted-fg)' }}
          >
            {present(displayDate) ? <time dateTime={displayDate}>{formatDate(displayDate)}</time> : null}
            {present(readingTime) ? (
              <>
                <span aria-hidden>·</span>
                <span>{readingTime}</span>
              </>
            ) : null}
          </div>
        ) : null}
        {tags.length ? (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <MonoPill key={t} variant="accent">
                {t}
              </MonoPill>
            ))}
          </div>
        ) : null}

        <hr className="my-10" style={{ borderColor: 'var(--border)' }} />

        <div>{body}</div>

        <hr className="my-12" style={{ borderColor: 'var(--border)' }} />
        <Link
          href={`/${username}/blog`}
          className="bp-link bp-mono inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase underline-offset-4 hover:underline"
          style={{ color: 'var(--accent-text)' }}
        >
          ← Back to all notes
        </Link>
      </article>
    </>
  );
}
