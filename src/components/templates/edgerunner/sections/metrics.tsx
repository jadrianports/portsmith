/**
 * Metrics section (edgerunner — the "by the numbers" stat block). Translated from the
 * export's `profile.stats` 4-stat grid inside `About.tsx` (D-08: stats extracted to a
 * first-class `metrics` section so the index places it immediately after About → reads
 * as one "About + stats" block visually). A FIRST-CLASS mapped soft-enum type (`metrics`
 * is in `sectionContentSchemas`). Mirrors the FROZEN `SectionProps` contract + `present()`
 * + content cast + null-guard + hide-if-empty. `index.tsx` wraps this in
 * `<ScrollReveal as="section">`, so this renders the INNER content.
 *
 * Casts `section.content` to `MetricsContent` (`{ heading, subheading?, items: [{ id,
 * value, label, icon? }] }`).
 *
 * RENDER CONTRACT: a mono `03 / metrics` kicker + heading + optional subheading, then a
 * responsive 2→4 col grid of holo-panel stat cards — each showing:
 *   - `value` (big neon-gradient-clip display number, e.g. "10M+")
 *   - `label` (muted mono, the stat name)
 *   - `icon` (optional — skipped here; the value is the visual focus)
 * The export's animated count-up + framer-motion are DROPPED (no client JS); the stat is
 * a static display string (the value carries its own units, the schema's design).
 *
 * PER-STAT STAGGER: each stat is a `<ScrollReveal as="li" delay={i * 60}>` island inside
 * a `<ul>` (list-style reset). Content is SSR-visible (the kit's no-JS / reduced-motion
 * fallback renders opacity:1 from frame 1).
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import type { SectionProps } from './types';
import type { MetricsContent, MetricItem } from '@/lib/validations';
import { ScrollReveal } from '../../_kit';
import { present } from './shared';

/**
 * A single compact stat card — the big neon-gradient-clip value over a muted label.
 * Compact variant: smaller padding, smaller value font, no hover lift.
 * Reproduces the reference's inline stat band (4 cards in a tight row).
 */
function MetricCard({ item }: { item: MetricItem }) {
  const value = present(item.value) ? item.value : null;
  const label = present(item.label) ? item.label : null;
  if (!value && !label) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '16px 20px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface)',
        border: '1px solid color-mix(in oklab, var(--neon-purple) 30%, var(--border))',
        backdropFilter: 'blur(8px)',
        textAlign: 'center',
        alignItems: 'center',
        flex: '1 1 120px',
      }}
    >
      {value ? (
        // Neon-gradient-clip number — compact size matching the reference's stat band.
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            lineHeight: 1.05,
            letterSpacing: '0.01em',
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
        // Muted label — mono uppercase small.
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 400,
            fontSize: '12px',
            lineHeight: 1.4,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
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

  return (
    /* Compact stat band — NO SectionHeading (no big section title). Visually reads
       as a continuation of the About section, not a standalone hero-sized section.
       Tight vertical padding; centered shell; cards in a flex row that wraps on mobile. */
    <div
      className="tmpl-shell"
      style={{
        paddingTop: '0',
        paddingBottom: '40px',
      }}
    >
      {/* Compact flex row of stat cards — wraps gracefully on narrow viewports. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'center',
        }}
      >
        {items.map((item, i) => (
          <ScrollReveal
            key={present(item.id) ? item.id : `${item.label}-${i}`}
            as="div"
            delay={i * 60}
          >
            <MetricCard item={item} />
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
