/**
 * Hero section (blueprint section 1) — a FAITHFUL 1:1 clone of the export's `Hero.tsx`: a
 * full-viewport masthead over a faint full-bleed PCB photo, a top→bottom gradient scrim, the
 * blueprint-grid texture, a soft blue radial glow, a mono `CH1` eyebrow, the OVERSIZED display
 * name, a mono subheading, an outline-accent CTA that FILLS on hover, a muted résumé link, and
 * a mono "instrument readout" status strip. `index.tsx` wraps this in `<ScrollReveal as="section"
 * priority>`, so this renders the hero INNER content (the LCP element — ZERO entrance motion;
 * the export's framer-motion entrance is dropped per the kit `priority` contract).
 *
 * DATA (null-guarded — every column + JSONB field is `| null`):
 *   - `content.heading`          → the oversized display name (required — hide if absent).
 *   - `content.subheading`       → the mono lede.
 *   - `content.background_image` → the faint full-bleed photo (Storage-origin; alt decorative).
 *   - `content.cta_text`/`cta_url` → the outline→fill CTA (defaults to "See my work" → #projects).
 *   - `content.resume_url`       → the muted "Résumé.pdf ↗" link (render-if-present).
 *   - `headline` (threaded)      → the `CH1` role eyebrow (the export's "HARDWARE_ENGINEER";
 *     persona-specific text is replaced by the real profile headline).
 *   - `location` (threaded)      → the "BASED · …" readout (only real data; the export's
 *     invented "UK / REMOTE" + "STATUS · ACTIVE" / "OPEN · CONTRACT" placeholders are dropped —
 *     missing data is omitted, not invented).
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { HeroContent } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';
import { safeHref } from '@/lib/safe-url';
import { Eyebrow, present } from './shared';

export interface HeroExtraProps {
  headline?: string | null;
  location?: string | null;
}

export function Hero({ section, headline, location }: SectionProps & HeroExtraProps) {
  const content = (section?.content ?? null) as HeroContent | null;
  if (!content) return null;

  const heading = present(content.heading) ? content.heading : null;
  if (!heading) return null; // hide-if-empty: nothing to anchor the hero on

  const subheading = present(content.subheading) ? content.subheading : null;
  const bgUrl = isHttpImageSrc(content.background_image) ? content.background_image : null;

  const ctaText = present(content.cta_text) ? content.cta_text : 'See my work';
  const ctaHref = safeHref(content.cta_url) ?? '#projects';
  const resumeHref = safeHref(content.resume_url);

  const roleLabel = present(headline) ? headline : 'Portfolio';
  const based = present(location) ? location : null;

  return (
    <div
      id="hero"
      className="relative min-h-[100svh] flex items-center overflow-hidden px-6 pt-24 pb-16"
    >
      {/* Faint full-bleed background photo. */}
      {bgUrl ? (
        <Image
          src={bgUrl}
          alt=""
          fill
          priority
          unoptimized
          sizes="100vw"
          style={{ objectFit: 'cover', opacity: 0.3 }}
        />
      ) : null}

      {/* Top→bottom gradient scrim fading the photo into the canvas. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, color-mix(in srgb, var(--bg) 70%, transparent), color-mix(in srgb, var(--bg) 85%, transparent), var(--bg))',
        }}
      />

      {/* Blueprint-grid texture. */}
      <div aria-hidden className="absolute inset-0 bp-bench-grid pointer-events-none" style={{ opacity: 0.5 }} />

      {/* Soft blue radial glow behind the name. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/3 -translate-x-1/2 h-[420px] w-[820px] max-w-[90vw] rounded-full"
        style={{
          filter: 'blur(120px)',
          background: 'radial-gradient(circle, rgba(37,99,235,0.18), transparent 70%)',
        }}
      />

      <div className="relative mx-auto max-w-[1100px] w-full">
        <Eyebrow channel="CH1">{roleLabel}</Eyebrow>

        <h1
          id="hero-heading"
          className="mt-6 text-5xl sm:text-6xl md:text-8xl font-bold leading-[0.95]"
          style={{ letterSpacing: '-0.04em' }}
        >
          {heading}
        </h1>

        {subheading ? (
          <p
            className="bp-mono mt-8 max-w-2xl text-sm sm:text-base leading-relaxed"
            style={{ color: 'var(--muted-fg)' }}
          >
            {subheading}
          </p>
        ) : null}

        <div className="mt-12 flex flex-wrap items-center gap-5">
          <a
            href={ctaHref}
            className="bp-cta bp-mono group relative inline-flex items-center gap-3 text-xs tracking-[0.18em] uppercase px-6 py-3.5 rounded-sm border"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent-text)' }}
          >
            <span>{ctaText}</span>
            <span aria-hidden className="bp-cta-arrow">→</span>
          </a>
          {resumeHref ? (
            <a
              href={resumeHref}
              target="_blank"
              rel="noreferrer"
              className="bp-link-muted bp-mono text-xs tracking-[0.18em] uppercase underline-offset-4 hover:underline"
              style={{ color: 'var(--muted-fg)' }}
            >
              Résumé.pdf ↗
            </a>
          ) : null}
        </div>

        {based ? (
          <div
            className="bp-mono mt-24 hidden md:flex items-center gap-6 text-[10px] tracking-[0.2em] uppercase"
            style={{ color: 'color-mix(in srgb, var(--muted-fg) 70%, transparent)' }}
          >
            <span>BASED · {based}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
