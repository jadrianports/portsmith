/**
 * Certifications section (aurora — NEW marketer-vertical type, 11-04 Step C1). Translated
 * from `marketing-girl/src/components/Certifications.tsx` (a credential list). A
 * FIRST-CLASS mapped soft-enum type (`certifications` is in `sectionContentSchemas`).
 * Mirrors the FROZEN `SectionProps` contract + `present()` + content cast + null-guard +
 * hide-if-empty + `safeHref`. `index.tsx` wraps this in `<ScrollReveal as="section">`, so
 * this renders the INNER content.
 *
 * Casts `section.content` to `CertificationsContent` (`{ heading, items: [{ id, title,
 * issuer?, year?, description?, url? }] }`).
 *
 * RENDER CONTRACT: a mono kicker + heading, then a responsive grid of credential cards —
 * each the title (Poppins 500), the issuer + optional year (mono meta), an optional
 * description, and an optional "Verify ↗" link (render-only-if-present, safeHref-gated).
 * Profession-agnostic: any credential (a marketer's HubSpot cert, a developer's AWS).
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import type { SectionProps } from './types';
import type { CertificationsContent, CertificationItem } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { hairlineStyle, headingStyle, kickerStyle, present, sectionShellStyle } from './shared';

/** A single credential card — title, issuer/year meta, optional description + verify link. */
function CertificationCard({ item }: { item: CertificationItem }) {
  const title = present(item.title) ? item.title : null;
  if (!title) return null;

  const issuer = present(item.issuer) ? item.issuer : null;
  const year = present(item.year) ? item.year : null;
  const description = present(item.description) ? item.description : null;
  const verifyUrl = safeHref(item.url) ?? null;

  const meta = [issuer, year].filter((m): m is string => Boolean(m)).join(' · ');

  return (
    <article
      className="tmpl-project-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '24px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: '1.125rem',
          lineHeight: 1.3,
          color: 'var(--fg)',
          margin: 0,
        }}
      >
        {title}
      </h3>

      {meta ? (
        <p
          style={{
            ...kickerStyle,
            color: 'var(--muted-fg)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {meta}
        </p>
      ) : null}

      {description ? (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '15px',
            lineHeight: 1.55,
            color: 'var(--muted-fg)',
            margin: 0,
          }}
        >
          {description}
        </p>
      ) : null}

      {verifyUrl ? (
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tmpl-project-link"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: '44px',
            marginTop: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Verify ↗
        </a>
      ) : null}
    </article>
  );
}

export function Certifications({ section }: SectionProps) {
  const content = (section?.content ?? null) as CertificationsContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.title))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Certifications';

  return (
    <div className="tmpl-shell" style={sectionShellStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={kickerStyle}>Certifications</p>
        <div aria-hidden="true" style={hairlineStyle} />
      </div>

      <h2 style={headingStyle}>{heading}</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px',
        }}
      >
        {items.map((item, i) => (
          <CertificationCard key={present(item.id) ? item.id : `${item.title}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
