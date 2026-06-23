/**
 * Testimonials section (atelier section — "Words") — a FAITHFUL clone of the export's
 * `Testimonials.tsx`: a header ("06 — Words" kicker + an OVERSIZED uppercase Bebas
 * headline), then a hairline-gap grid of up to 3 quote figures, each with an oversized
 * acid quote mark, the quote in the display face, and a bordered figcaption (name + role).
 * `index.tsx` wraps this in `<ScrollReveal as="section">`, so this renders the INNER
 * content.
 *
 * TRANSLATION NOTES (lovable-ingest): the export used framer-motion staggered reveals +
 * three hardcoded quote objects (`q`/`a`/`r`). ALL stripped to a pure Server Component:
 * the reveals become the kit ScrollReveal + CSS; the quotes are the data-driven
 * `content.items` (`quote` → the blockquote, `name` → attribution, `company` → the role
 * line). The hairline grid, the oversized acid quote mark, the bordered figcaption, and
 * the header are reproduced EXACTLY. Optional `avatar`/`stars` are rendered when present
 * (a faithful enhancement — the export had neither, but they never break the layout).
 *
 * HIDE-IF-EMPTY: renders ONLY when `section.visible === true` AND there is >=1 real quote
 * — never a placeholder block.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import type { SectionProps } from './types';
import type { TestimonialsContent, TestimonialItem } from '@/lib/validations';
import { headingStyle, kickerStyle, present } from './shared';

/** A single quote figure — acid quote mark, quote, bordered name/role caption. */
function QuoteCard({ item }: { item: TestimonialItem }) {
  const quote = present(item.quote) ? item.quote : null;
  if (!quote) return null;
  const name = present(item.name) ? item.name : null;
  const company = present(item.company) ? item.company : null;

  return (
    <figure
      style={{
        display: 'flex',
        flexDirection: 'column',
        margin: 0,
        padding: 'clamp(32px, 4vw, 40px)',
        background: 'var(--bg)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '4.5rem',
          lineHeight: 1,
          color: 'var(--accent)',
        }}
      >
        &ldquo;
      </span>

      <blockquote
        style={{
          margin: '16px 0 0',
          flex: 1,
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: 'clamp(1.25rem, 1.6vw, 1.5rem)',
          lineHeight: 1.25,
          letterSpacing: '0.01em',
          color: 'var(--fg)',
        }}
      >
        {quote}
      </blockquote>

      {name || company ? (
        <figcaption
          style={{ marginTop: '32px', paddingTop: '16px', borderTop: '1px solid var(--border-strong)' }}
        >
          {name ? (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--fg)' }}>
              {name}
            </div>
          ) : null}
          {company ? (
            <div style={{ ...kickerStyle, marginTop: '4px', color: 'var(--muted-fg)' }}>{company}</div>
          ) : null}
        </figcaption>
      ) : null}
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

  const heading = present(content?.heading) ? content.heading : 'Words';

  return (
    <div className="tmpl-shell" style={{ paddingBlock: 'clamp(96px, 14vh, 160px)' }}>
      <div style={{ marginBottom: 'clamp(56px, 8vh, 96px)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <p style={kickerStyle}>06 — Words</p>
        <h2 style={headingStyle}>{heading}</h2>
      </div>

      {/* Hairline-gap grid (the export's `gap-px bg-[--hairline]` — the 1px gaps read as
          dividing rules between the quote panels). */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1px',
          background: 'var(--border-strong)',
          border: '1px solid var(--border-strong)',
        }}
      >
        {items.map((item, i) => (
          <QuoteCard key={`${item.id ?? item.name ?? 'quote'}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
