/**
 * ShowcaseCard — a browser-frame proof mockup (D-03 / D-04 / D-05 / D-12).
 *
 * The WHOLE card is a single outbound `<a>` opening the LIVE portfolio in a new tab
 * (`target="_blank" rel="noopener noreferrer"` — the reverse-tabnabbing + a11y safety
 * attrs, T-22-05), with a descriptive `aria-label` as the accessible destination. The
 * href origin is `siteUrl()`-derived (`NEXT_PUBLIC_SITE_URL`), NEVER the request Host
 * (T-22-03 / D-22-adjacent invariant).
 *
 * Inside: a token-driven browser-chrome frame —
 *   1. a `--color-surface-muted` chrome bar with three decorative `--radius-full`
 *      traffic-light dots (`aria-hidden`) + a `--radius-sm` `--color-surface` inset
 *      address bar PRINTING the literal `portsmith.vercel.app/<username>` in `--font-mono`
 *      (D-05 — decorative; the accessible destination is the link aria-label). The printed
 *      host is the production vercel host (the page the visitor actually lands on), so it is
 *      a static literal, NOT `siteUrl()` (which is localhost in dev).
 *   2. the committed static `<img>` (D-12 — captured by Plan 04) with a MANDATORY
 *      descriptive `alt` and `loading="lazy"` (below the fold — never blocks LCP).
 *   3. a Body caption naming the profession contrast + a decorative `external-link` glyph.
 *
 * Highest two-layer-leak-risk surface — EVERY color is a chrome `@theme` token; no inline
 * hex, no template token, no `components/templates` import (the landing-isolation guard
 * enforces this). Card hover lifts via `--shadow-card`/`--color-border-strong`
 * (color/shadow only — reduced-motion-safe).
 */
import { ExternalLink } from 'lucide-react';

import { siteUrl } from '@/lib/url';

/** The production host printed in the address bar (D-05). Static literal — see file header. */
const DISPLAY_HOST = 'portsmith.vercel.app';

export interface ShowcaseCardProps {
  /** The published portfolio username — drives both the printed URL and the siteUrl() href. */
  username: string;
  /** Committed static screenshot path under /public (captured by Plan 04). */
  imageSrc: string;
  /** Mandatory descriptive alt naming the profession + template. */
  alt: string;
  /** Body caption naming the profession contrast. */
  caption: string;
  /** Display name for the new-tab aria-label. */
  name: string;
}

export function ShowcaseCard({ username, imageSrc, alt, caption, name }: ShowcaseCardProps) {
  return (
    <a
      href={siteUrl(`/${username}`)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View ${name}'s live portfolio (opens in a new tab)`}
      className="group block overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-card)] outline-none transition-colors hover:border-border-strong focus-visible:[box-shadow:var(--shadow-focus)]"
    >
      {/* Browser-chrome bar — traffic-light dots + the mono address bar. */}
      <div className="flex items-center gap-3 border-b border-border bg-surface-muted px-3 py-2">
        <span className="flex items-center gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
        </span>
        <span className="flex-1 truncate rounded-sm bg-surface px-2 py-1 text-sm text-muted-foreground [font-family:var(--font-mono)]">
          {`${DISPLAY_HOST}/${username}`}
        </span>
      </div>
      {/* The committed static screenshot (Plan 04 captures the asset; the path is wired now). */}
      <img src={imageSrc} alt={alt} loading="lazy" className="block aspect-[16/10] w-full object-cover" />
      {/* Caption naming the profession contrast + a decorative external-link glyph. */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-base text-muted-foreground">{caption}</span>
        <ExternalLink aria-hidden="true" className="size-4 text-muted-foreground" />
      </div>
    </a>
  );
}
