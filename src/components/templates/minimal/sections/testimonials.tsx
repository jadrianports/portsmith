/**
 * Testimonials section (D-05 section 6) — UI-SPEC §"6. Testimonials". Replaces the
 * 03-04 stub: the body is real, the SHARED `SectionProps` signature, the export
 * name, and the `index.tsx` wiring are UNCHANGED (frozen 03-04 contract —
 * `index.tsx` is NOT edited, no new prop). `index.tsx` already wraps this in
 * `<ScrollReveal as="section">`, so this renders the section's INNER content (no
 * `<section>` of its own).
 *
 * HIDE-IF-EMPTY (D-06 — never ship placeholder quotes): this section renders ONLY
 * when there is real content to show. `index.tsx` resolves the section from the
 * `public_sections` view, which already EXCLUDES `visible = false` rows — so on the
 * seeded page (Testimonials is seeded `visible: false` until James has ≥2 real
 * quotes) the `section` row never even reaches this component and it is absent. As a
 * belt-and-suspenders guard the component ALSO returns `null` when the content has
 * no items: `if (!items.length) return null;`. It NEVER renders an empty/placeholder
 * block (T-03-21). The visibility flag flips it on the moment real content exists.
 *
 * RENDER CONTRACT (UI-SPEC §6) — per item:
 *   - the quote as **Body 16px emphasis** = General Sans 600 (NOT a separate size,
 *     NOT italics-as-bold), the most prominent line of the card.
 *   - the name (Clash Display / foreground).
 *   - the company as a mono label (render-if-present).
 *   - the optional avatar in a `--radius-full` frame WITH its required `avatar_alt`
 *     (render-only-if-present; the Zod alt-text refine guarantees alt when avatar is
 *     set, re-guarded here since view columns are nullable).
 *   - the optional `stars` (1–5): filled/empty star glyphs rendered ONLY when
 *     `stars` is present.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 *
 * AVATAR / next/image NOTE (Rule-3, matching About/Projects 03-06/07): avatars are
 * free-form remote `https` URLs; `next/image` optimization would require an
 * `images.remotePatterns` host allowlist (architectural, host-dependent) and the
 * project does client-side WebP with NO server image processing (CLAUDE.md, Vercel
 * free tier). So the avatar uses `next/image` with `unoptimized` — it KEEPS the
 * width/height/CLS-safety + required-alt contract while rendering any host.
 */
import Image from 'next/image';
import type { SectionProps } from './types';
import type { TestimonialsContent, TestimonialItem } from '@/lib/validations';

/** A string field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Clamp a (possibly nullable) star count into the 1–5 integer range, or null. */
function starCount(stars: number | null | undefined): number | null {
  if (typeof stars !== 'number' || !Number.isFinite(stars)) return null;
  const n = Math.round(stars);
  if (n < 1) return null;
  return Math.min(n, 5);
}

/**
 * The 1–5 star row — gold filled glyphs + muted empty glyphs, rendered ONLY when a
 * star count is present. Decorative; the row carries an accessible label so the
 * rating is conveyed without relying on glyph styling alone.
 */
function Stars({ count }: { count: number }) {
  return (
    <span
      role="img"
      aria-label={`${count} out of 5 stars`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={i <= count ? 'var(--accent-gold)' : 'none'}
          stroke={i <= count ? 'var(--accent-gold)' : 'var(--muted-fg)'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 7.1-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

/** A single testimonial card — quote (emphasis), name, company, optional avatar/stars. */
function TestimonialCard({ item }: { item: TestimonialItem }) {
  const quote = present(item.quote) ? item.quote : null;
  const name = present(item.name) ? item.name : null;
  const company = present(item.company) ? item.company : null;

  // Avatar renders ONLY if a URL is present AND its required alt is present.
  const avatarUrl = present(item.avatar) ? item.avatar : null;
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
      {stars !== null ? <Stars count={stars} /> : null}

      {/* The quote — Body 16px EMPHASIS = General Sans 600 (NOT italics, NOT a new
          size). The most prominent line of the card. */}
      <blockquote
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: '16px',
          lineHeight: 1.6,
          color: 'var(--fg)',
        }}
      >
        {quote}
      </blockquote>

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
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              display: 'inline-block',
              // Faint cyan ring (mirrors the About avatar treatment).
              boxShadow: '0 0 0 2px var(--accent-cyan)',
            }}
          >
            <Image
              src={avatarUrl as string}
              alt={avatarAlt as string}
              width={40}
              height={40}
              // Remote avatars on arbitrary hosts → skip the optimizer (Rule-3);
              // width/height still reserve space → no CLS.
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
                fontFamily: 'var(--font-display)',
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
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                lineHeight: 1.4,
                color: 'var(--muted-fg)',
              }}
            >
              {company}
            </span>
          ) : null}
        </span>
      </figcaption>
    </figure>
  );
}

export function Testimonials({ section }: SectionProps) {
  // Cast the validated JSONB content; null-guard the row + every field.
  const content = (section?.content ?? null) as TestimonialsContent | null;

  // hide-if-empty (D-06): no content / no items → render NOTHING. The seed ships
  // this section `visible: false` AND `items: []`, so on the seeded page the row is
  // excluded by the public view AND this guard returns null — never a placeholder.
  const items = Array.isArray(content?.items)
    ? content.items.filter((it) => present(it?.quote))
    : [];
  if (!items.length) return null;

  const heading = present(content?.heading) ? content.heading : 'Testimonials';

  return (
    <div
      // `.tmpl-shell`: the shared centered max-width + horizontal gutter (theme.css).
      className="tmpl-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        paddingBlock: '64px',
      }}
    >
      {/* Mono section label `06 / words` (cyan, per the hero precedent). */}
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 500,
          lineHeight: 1.4,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--accent-cyan)',
          margin: 0,
        }}
      >
        06 / words
      </p>

      {/* Section heading (Clash Display Heading scale, foreground — not gradient). */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(1.75rem, 4vw, 2rem)',
          lineHeight: 1.2,
          color: 'var(--fg)',
          margin: 0,
        }}
      >
        {heading}
      </h2>

      {/* Responsive card grid — auto-fill reflows from 1 col (mobile) to several
          (desktop) with no media query. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px',
        }}
      >
        {items.map((item, i) => (
          <TestimonialCard key={`${item.id ?? item.name ?? 'quote'}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
