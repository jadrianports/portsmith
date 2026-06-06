/**
 * Testimonials section (aurora section 9) — the rosy client quotes (translated from
 * `marketing-girl/src/components/Testimonials.tsx`). Mirrors the FROZEN `SectionProps`
 * contract + `present()` + content cast + null-guard + hide-if-empty + the visibility
 * gate + the star clamping EXACTLY. `index.tsx` wraps this in `<ScrollReveal
 * as="section">`, so this renders the INNER content.
 *
 * HIDE-IF-EMPTY: renders ONLY when `section.visible === true` AND there is >=1 real
 * quote — never a placeholder block (the public view already excludes visible===false
 * rows; the explicit check makes the contract local + testable). The source's unsplash
 * avatars become null-guarded Storage-origin reads.
 *
 * Casts `section.content` to `TestimonialsContent` (`{ heading, items: [{ name, quote,
 * avatar?, avatar_alt?, stars?, company? }] }`).
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { TestimonialsContent, TestimonialItem } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';
import { hairlineStyle, headingStyle, kickerStyle, present, sectionShellStyle } from './shared';

/** Clamp a (possibly nullable) star count into the 1–5 integer range, or null. */
function starCount(stars: number | null | undefined): number | null {
  if (typeof stars !== 'number' || !Number.isFinite(stars)) return null;
  const n = Math.round(stars);
  if (n < 1) return null;
  return Math.min(n, 5);
}

/** The 1–5 star row as soft rose dots — filled / empty, with an accessible label. */
function Stars({ count }: { count: number }) {
  return (
    <span
      role="img"
      aria-label={`${count} out of 5 stars`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: 'var(--radius-full)',
            background: i <= count ? 'var(--accent)' : 'transparent',
            border: i <= count ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
          }}
        />
      ))}
    </span>
  );
}

/** A single quote card — quote, attribution, optional avatar/stars. */
function TestimonialCard({ item }: { item: TestimonialItem }) {
  const quote = present(item.quote) ? item.quote : null;
  const name = present(item.name) ? item.name : null;
  const company = present(item.company) ? item.company : null;

  const avatarUrl = isHttpImageSrc(item.avatar) ? item.avatar : null;
  const avatarAlt = present(item.avatar_alt) ? item.avatar_alt : null;
  const showAvatar = Boolean(avatarUrl && avatarAlt);

  const stars = starCount(item.stars);

  if (!quote) return null;

  return (
    <figure
      className="tmpl-project-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        margin: 0,
        padding: '28px 24px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Oversized rose quote mark (gradient-clip — the aurora signature). */}
      <span
        aria-hidden="true"
        className="tmpl-hero-name"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: '3rem',
          lineHeight: 0.6,
          color: 'var(--accent)',
        }}
      >
        &ldquo;
      </span>

      {stars !== null ? <Stars count={stars} /> : null}

      <blockquote
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize: '1.0625rem',
          lineHeight: 1.55,
          color: 'var(--fg)',
        }}
      >
        {quote}
      </blockquote>

      <div
        aria-hidden="true"
        style={{ height: '1px', width: '100%', background: 'var(--border)', marginTop: '8px' }}
      />

      <figcaption style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: 'auto' }}>
        {showAvatar ? (
          <span
            style={{
              flex: '0 0 auto',
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              display: 'inline-block',
              border: '1px solid var(--border-strong)',
            }}
          >
            <Image
              src={avatarUrl as string}
              alt={avatarAlt as string}
              width={44}
              height={44}
              unoptimized
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </span>
        ) : null}

        <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {name ? (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '15px',
                lineHeight: 1.2,
                color: 'var(--fg)',
              }}
            >
              {name}
            </span>
          ) : null}
          {company ? <span style={{ ...kickerStyle, color: 'var(--muted-fg)' }}>{company}</span> : null}
        </span>
      </figcaption>
    </figure>
  );
}

export function Testimonials({ section }: SectionProps) {
  // EXPLICIT visibility gate: render ONLY when the section is visible.
  if (section?.visible !== true) return null;

  const content = (section?.content ?? null) as TestimonialsContent | null;

  const items = Array.isArray(content?.items)
    ? content.items.filter((it) => present(it?.quote))
    : [];
  if (items.length < 1) return null;

  const heading = present(content?.heading) ? content.heading : 'Testimonials';

  return (
    <div className="tmpl-shell" style={sectionShellStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={kickerStyle}>Words</p>
        <div aria-hidden="true" style={hairlineStyle} />
      </div>

      <h2 style={headingStyle}>{heading}</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '28px',
        }}
      >
        {items.map((item, i) => (
          <TestimonialCard key={`${item.id ?? item.name ?? 'quote'}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
