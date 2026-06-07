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
import { present, sectionShellStyle } from './shared';
import { SectionHeading } from './ui/section-heading';

/**
 * A single stat card — the big neon-gradient-clip value over a muted label.
 * Reproduces the export's `rounded-xl border border-neon-purple/30 bg-card/60 p-4
 * backdrop-blur-md` stat panel + Orbitron display number + VT323 label.
 */
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
        border: '1px solid color-mix(in oklab, var(--neon-purple) 30%, var(--border))',
        backdropFilter: 'blur(8px)',
        textAlign: 'center',
        alignItems: 'center',
      }}
    >
      {value ? (
        // Big neon-gradient-clip number (Orbitron 800, the export's `font-display
        // text-3xl font-bold text-neon-pink text-glow-pink` treatment re-authored as
        // a gradient-clip so no text-shadow is required here).
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(2rem, 5vw, 3rem)',
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
        // Muted label — VT323 mono (the export's `font-mono-retro text-foreground/70`).
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 400,
            fontSize: '15px',
            lineHeight: 1.45,
            letterSpacing: '0.06em',
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

  const heading = present(content.heading) ? content.heading : 'By the numbers';
  const subheading = present(content.subheading) ? content.subheading : null;

  return (
    <div className="tmpl-shell" style={sectionShellStyle}>
      {/* Section header — centered eyebrow + big neon-glow title + optional subtitle. */}
      <SectionHeading
        eyebrow="// BY THE NUMBERS"
        title={heading}
        description={subheading ?? undefined}
        accent="pink"
      />

      {/* Responsive 2→4 col grid (the export's `grid-cols-2 gap-4 sm:grid-cols-4`).
          Each stat is a ScrollReveal island with per-stat entrance stagger (i * 60ms)
          — SSR-visible (opacity:1 before JS). The <ul> resets list styles. */}
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '16px',
        }}
      >
        {items.map((item, i) => (
          <ScrollReveal
            key={present(item.id) ? item.id : `${item.label}-${i}`}
            as="li"
            delay={i * 60}
          >
            <MetricCard item={item} />
          </ScrollReveal>
        ))}
      </ul>
    </div>
  );
}
