/**
 * Testimonials section (D-P7-10 section 6) — the Newsprint editorial pull-quotes
 * (07-UI-SPEC A.7 §6). Mirrors `minimal/sections/testimonials.tsx`'s FROZEN
 * `SectionProps` contract + `present()` + content cast + null-guard + hide-if-empty +
 * the star clamping EXACTLY; the visual body is the editorial pull-quote layout.
 * `index.tsx` wraps this in `<ScrollReveal as="section">`, so this renders the
 * section's INNER content.
 *
 * HIDE-IF-EMPTY (A.7 §6 — never ship placeholder quotes): this section renders ONLY
 * when `section.visible === true` AND there is >=1 real quote. `index.tsx` resolves
 * the section from the `public_sections` view, which already EXCLUDES `visible = false`
 * rows — so on the seeded page (Testimonials is seeded `visible: false` until there
 * are >=2 real quotes) the row never even reaches this component. As an EXPLICIT
 * belt-and-suspenders guard (A.7 §6 contract) the component ALSO checks
 * `section.visible === true` AND returns `null` when the content has no items. It
 * NEVER renders an empty/placeholder block (T-07-07). The visibility flag flips it on
 * the moment real content exists.
 *
 * RENDER CONTRACT (A.7 §6) — per item:
 *   - the quote set in **Fraunces 400** as a large pull-quote (the restrained second
 *     serif moment) with an oversized quote mark.
 *   - the attribution name + optional company (mono/Body).
 *   - the optional avatar in a near-square frame WITH its required `avatar_alt`
 *     (render-only-if-present).
 *   - the optional `stars` (1–5): SQUARE ticks (filled/empty), render-only-if-present.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 *
 * AVATAR / next/image NOTE (Rule-3, matching About/Projects): avatars are free-form
 * remote `https` URLs; `next/image` optimization would require an
 * `images.remotePatterns` host allowlist (architectural) and the project does
 * client-side WebP with NO server image processing (CLAUDE.md). So the avatar uses
 * `next/image` with `unoptimized` — KEEPS width/height/CLS-safety + required-alt while
 * rendering any host. WR-05: `unoptimized` skips the host allowlist → scheme-check here.
 */
import Image from 'next/image';
import type { SectionProps } from './types';
import type { TestimonialsContent, TestimonialItem } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';

/** A string field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Mono kicker label — uppercase JetBrains Mono. */
const kickerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  fontWeight: 500,
  lineHeight: 1.4,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: 'var(--muted-fg)',
  margin: 0,
};

/** Clamp a (possibly nullable) star count into the 1–5 integer range, or null. */
function starCount(stars: number | null | undefined): number | null {
  if (typeof stars !== 'number' || !Number.isFinite(stars)) return null;
  const n = Math.round(stars);
  if (n < 1) return null;
  return Math.min(n, 5);
}

/**
 * The 1–5 star row as SQUARE ticks (editorial — not glowing stars): filled vermilion
 * squares + empty bordered squares, rendered ONLY when a star count is present. The
 * row carries an accessible label so the rating is conveyed without relying on glyph
 * styling alone.
 */
function Stars({ count }: { count: number }) {
  return (
    <span
      role="img"
      aria-label={`${count} out of 5 stars`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            background: i <= count ? 'var(--accent)' : 'transparent',
            border: i <= count ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
          }}
        />
      ))}
    </span>
  );
}

/** A single pull-quote — Fraunces-400 quote, attribution, optional avatar/stars. */
function TestimonialCard({ item }: { item: TestimonialItem }) {
  const quote = present(item.quote) ? item.quote : null;
  const name = present(item.name) ? item.name : null;
  const company = present(item.company) ? item.company : null;

  const avatarUrl = isHttpImageSrc(item.avatar) ? item.avatar : null;
  const avatarAlt = present(item.avatar_alt) ? item.avatar_alt : null;
  const showAvatar = Boolean(avatarUrl && avatarAlt);

  const stars = starCount(item.stars);

  // A card needs at least a quote to be meaningful.
  if (!quote) return null;

  return (
    <figure
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        margin: 0,
        padding: '24px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Oversized ink quote mark (the editorial pull-quote signature). */}
      <span
        aria-hidden="true"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: '3rem',
          lineHeight: 0.6,
          color: 'var(--fg)',
        }}
      >
        &ldquo;
      </span>

      {stars !== null ? <Stars count={stars} /> : null}

      {/* The quote — Fraunces 400 pull-quote (the restrained second serif moment). */}
      <blockquote
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: '1.375rem',
          lineHeight: 1.4,
          color: 'var(--fg)',
        }}
      >
        {quote}
      </blockquote>

      {/* Ink hairline rule above the attribution. */}
      <div
        aria-hidden="true"
        style={{ height: '1px', width: '100%', background: 'var(--border)', marginTop: '8px' }}
      />

      {/* Attribution — optional avatar (with required alt) + name + mono company. */}
      <figcaption
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginTop: 'auto',
        }}
      >
        {showAvatar ? (
          <span
            style={{
              flex: '0 0 auto',
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              display: 'inline-block',
              // A thin ink border (near-square editorial frame).
              border: '1px solid var(--fg)',
            }}
          >
            <Image
              src={avatarUrl as string}
              alt={avatarAlt as string}
              width={40}
              height={40}
              unoptimized
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </span>
        ) : null}

        <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {name ? (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '16px',
                lineHeight: 1.2,
                color: 'var(--fg)',
              }}
            >
              {name}
            </span>
          ) : null}
          {company ? (
            <span style={kickerStyle}>{company}</span>
          ) : null}
        </span>
      </figcaption>
    </figure>
  );
}

export function Testimonials({ section }: SectionProps) {
  // EXPLICIT visibility gate (A.7 §6 contract): render ONLY when the section is
  // visible. The public view already excludes visible===false rows (so the row
  // normally never reaches here), but this belt-and-suspenders check makes the
  // hide-if-empty contract local + testable.
  if (section?.visible !== true) return null;

  // Cast the validated JSONB content; null-guard the row + every field.
  const content = (section?.content ?? null) as TestimonialsContent | null;

  // hide-if-empty (A.7 §6): no content / no items → render NOTHING. Never a placeholder.
  const items = Array.isArray(content?.items)
    ? content.items.filter((it) => present(it?.quote))
    : [];
  if (items.length < 1) return null;

  const heading = present(content?.heading) ? content.heading : 'Testimonials';

  return (
    <div
      className="tmpl-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        paddingBlock: 'clamp(64px, 12vh, 120px)',
      }}
    >
      {/* Mono kicker `06 — WORDS` above an ink rule. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={kickerStyle}>06 — Words</p>
        <div
          aria-hidden="true"
          style={{ height: '1px', width: '100%', background: 'var(--fg)' }}
        />
      </div>

      {/* Section heading (Fraunces, ink — not the accent). */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(1.5rem, 3vw, 2rem)',
          lineHeight: 1.15,
          color: 'var(--fg)',
          margin: 0,
        }}
      >
        {heading}
      </h2>

      {/* Responsive pull-quote grid — auto-fill reflows from 1 col (mobile) to several
          (desktop) with no media query. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '32px',
        }}
      >
        {items.map((item, i) => (
          <TestimonialCard key={`${item.id ?? item.name ?? 'quote'}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
