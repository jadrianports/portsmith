/**
 * Services section (aurora — NEW marketer-vertical type, 11-04 Step C1). Translated from
 * `marketing-girl/src/components/Services.tsx` (an offerings list). A FIRST-CLASS mapped
 * soft-enum type (`services` is in `sectionContentSchemas`). Mirrors the FROZEN
 * `SectionProps` contract + `present()` + content cast + null-guard + hide-if-empty.
 * `index.tsx` wraps this in `<ScrollReveal as="section">`, so this renders the INNER content.
 *
 * Casts `section.content` to `ServicesContent` (`{ heading, subheading?, items: [{ id,
 * title, description?, icon?, deliverables? }] }`).
 *
 * RENDER CONTRACT: a mono kicker + heading + optional subheading, then a responsive grid
 * of service cards — each the title (Poppins 500), an optional description (Body), and an
 * optional deliverables bullet list. The source's framer-motion + icon-glyph chroma are
 * dropped; the `icon` slug is informational (cards lead with the title). Profession-
 * agnostic: any offering list (a marketer's packages, a developer's consulting) fits.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import type { SectionProps } from './types';
import type { ServicesContent, ServiceItem } from '@/lib/validations';
import { hairlineStyle, headingStyle, kickerStyle, present, sectionShellStyle } from './shared';

/** A single service card — title, optional description, optional deliverables list. */
function ServiceCard({ item }: { item: ServiceItem }) {
  const title = present(item.title) ? item.title : null;
  if (!title) return null;

  const description = present(item.description) ? item.description : null;
  const deliverables = Array.isArray(item.deliverables)
    ? item.deliverables.filter((d) => present(d))
    : [];

  return (
    <article
      className="tmpl-project-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        padding: '28px 24px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {/* A small rose accent bar (the source's accent flourish, token-driven). */}
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          width: '40px',
          height: '4px',
          borderRadius: '4px',
          background: 'var(--aurora-gradient)',
        }}
      />

      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: '1.25rem',
          lineHeight: 1.25,
          color: 'var(--fg)',
          margin: 0,
        }}
      >
        {title}
      </h3>

      {description ? (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: 1.6,
            color: 'var(--muted-fg)',
            margin: 0,
            whiteSpace: 'pre-line',
          }}
        >
          {description}
        </p>
      ) : null}

      {deliverables.length > 0 ? (
        <ul
          style={{
            listStyle: 'none',
            margin: '4px 0 0',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {deliverables.map((d, di) => (
            <li
              key={`${d}-${di}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: '15px',
                lineHeight: 1.5,
                color: 'var(--muted-fg)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  flex: '0 0 auto',
                  marginTop: '7px',
                  width: '6px',
                  height: '6px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--accent)',
                }}
              />
              {d}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function Services({ section }: SectionProps) {
  const content = (section?.content ?? null) as ServicesContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.title))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Services';
  const subheading = present(content.subheading) ? content.subheading : null;

  return (
    <div className="tmpl-shell" style={sectionShellStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={kickerStyle}>Services</p>
        <div aria-hidden="true" style={hairlineStyle} />
      </div>

      <h2 style={headingStyle}>{heading}</h2>

      {subheading ? (
        <p
          className="tmpl-measure"
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: 1.55,
            color: 'var(--muted-fg)',
            margin: 0,
          }}
        >
          {subheading}
        </p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px',
        }}
      >
        {items.map((item, i) => (
          <ServiceCard key={present(item.id) ? item.id : `${item.title}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
