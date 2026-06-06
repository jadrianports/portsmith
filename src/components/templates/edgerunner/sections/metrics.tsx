/**
 * Metrics section (edgerunner — the "by the numbers" stat block). Translated from the
 * export's `profile.stats` (D-08: `profile.stats → metrics`, the precedent aurora set).
 * A FIRST-CLASS mapped soft-enum type (`metrics` is in `sectionContentSchemas`). Mirrors
 * the FROZEN `SectionProps` contract + `present()` + content cast + null-guard +
 * hide-if-empty. `index.tsx` wraps this in `<ScrollReveal as="section">`, so this
 * renders the INNER content.
 *
 * Casts `section.content` to `MetricsContent` (`{ heading, subheading?, items: [{ id,
 * value, label, icon? }] }`).
 *
 * RENDER CONTRACT: a mono kicker + heading + optional subheading, then a responsive
 * grid of neon stat cards — each a large neon-clip `value` (e.g. "10M+") over a muted
 * `label`. The source's animated count-up + framer-motion are DROPPED (no client JS —
 * the aurora precedent); the stat is a static display string (the value carries its own
 * units). The `icon` slug is informational only here (the value is the visual focus).
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import type { SectionProps } from './types';
import type { MetricsContent, MetricItem } from '@/lib/validations';
import { hairlineStyle, headingStyle, kickerStyle, present, sectionShellStyle } from './shared';

/** A single stat card — the big neon-clip value over a muted label. */
function MetricCard({ item }: { item: MetricItem }) {
  const value = present(item.value) ? item.value : null;
  const label = present(item.label) ? item.label : null;
  if (!value && !label) return null;

  return (
    <div
      className="tmpl-project-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '28px 24px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        textAlign: 'center',
        alignItems: 'center',
      }}
    >
      {value ? (
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            lineHeight: 1.05,
            letterSpacing: '0.01em',
            // Neon-gradient clip — the synthwave stat treatment.
            backgroundImage: 'var(--neon-gradient)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
      ) : null}
      {label ? (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '15px',
            lineHeight: 1.45,
            color: 'var(--muted-fg)',
          }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}

export function Metrics({ section }: SectionProps) {
  const content = (section?.content ?? null) as MetricsContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.value) || present(it?.label))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'By the numbers';
  const subheading = present(content.subheading) ? content.subheading : null;

  return (
    <div className="tmpl-shell" style={sectionShellStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={kickerStyle}>03 / metrics</p>
        <div aria-hidden="true" style={hairlineStyle} />
      </div>

      <h2 style={headingStyle}>{heading}</h2>

      {subheading ? (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: 1.55,
            color: 'var(--muted-fg)',
            margin: 0,
            maxWidth: '60ch',
          }}
        >
          {subheading}
        </p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '24px',
        }}
      >
        {items.map((item, i) => (
          <MetricCard key={present(item.id) ? item.id : `${item.label}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
