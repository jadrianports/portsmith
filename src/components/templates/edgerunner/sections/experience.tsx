/**
 * Experience section (edgerunner section 4) — the synthwave vertical neon timeline
 * (faithful clone of `synthwave-founder/src/components/sections/Experience.tsx`).
 * Mirrors the FROZEN `SectionProps` contract + `present()` + content cast + null-guard
 * + hide-if-empty + the date-formatting helpers (copied verbatim from aurora's pattern).
 * `index.tsx` wraps this in `<ScrollReveal as="section">`, so this renders INNER content.
 *
 * RENDER CONTRACT:
 *   - `<SectionHeading>` eyebrow + title (the section label + display heading).
 *   - A neon gradient SPINE rule: left on mobile, centered on `md+` (matching the export).
 *   - `<ul>` with alternating left/right cards on `md+`, single column on mobile.
 *   - Per item: neon-pink node marker on the spine; PERIOD (mono cyan); ROLE (display);
 *     COMPANY (neon-pink glow); DESCRIPTION (muted body); HIGHLIGHTS (cyan-dot bullets,
 *     rendered ONLY when present and non-empty). NO `location` (not in schema).
 *   - Each item wrapped in `<ScrollReveal as="li" delay={i*50}>` for entrance stagger.
 *
 * FIELDS: `ExperienceContent.items[].{ id, company, role, start_date, end_date,
 *   description, highlights? }`. No `location` (export had one — dropped, not in schema).
 *
 * DATES: `YYYY-MM` → year only (e.g. `2020`); `'present'` → "Present"; empty end → start
 *   only. Helper copied verbatim from `aurora/sections/experience.tsx`.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 * React escapes all seeded text by default (no `dangerouslySetInnerHTML`).
 */
import type { CSSProperties } from 'react';
import type { SectionProps } from './types';
import type { ExperienceContent, ExperienceItem } from '@/lib/validations';
import { present, sectionShellStyle } from './shared';
import { SectionHeading } from './ui/section-heading';
import { GlowCard } from './ui/glow-card';
import { ScrollReveal } from '../../_kit';

// ---------------------------------------------------------------------------
// Date-formatting helpers — copied verbatim from aurora/sections/experience.tsx
// ---------------------------------------------------------------------------

/**
 * Format a single date value: `'present'` → "Present"; a `YYYY-MM` string → its `YYYY`
 * year; empty/absent → `null`.
 */
function formatDatePart(value: string | null | undefined): string | null {
  if (!present(value)) return null;
  const v = value.trim();
  if (v.toLowerCase() === 'present') return 'Present';
  const match = /^(\d{4})-\d{2}$/.exec(v);
  return match ? match[1] : v;
}

/** Build the displayed date range, e.g. `2020 — Present`; `null` when no start date. */
function formatRange(start: string | null | undefined, end: string | null | undefined): string | null {
  const startPart = formatDatePart(start);
  if (!startPart) return null;
  const endPart = formatDatePart(end);
  return endPart ? `${startPart} — ${endPart}` : startPart;
}

// ---------------------------------------------------------------------------
// Per-item card — company, role, dates, description, highlights.
// `left` controls the alternating layout on md+.
// ---------------------------------------------------------------------------

function ExperienceCard({ item, left }: { item: ExperienceItem; left: boolean }) {
  const company = present(item.company) ? item.company : null;
  const role = present(item.role) ? item.role : null;
  const dateRange = formatRange(item.start_date, item.end_date);
  const description = present(item.description) ? item.description : null;
  const highlights = Array.isArray(item.highlights)
    ? item.highlights.filter((h) => present(h))
    : [];

  const dateStyle: CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.3,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--neon-cyan)',
    fontVariantNumeric: 'tabular-nums',
    margin: 0,
  };

  const roleStyle: CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: '1.125rem',
    lineHeight: 1.2,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    color: 'var(--fg)',
    margin: 0,
  };

  const companyStyle: CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontWeight: 400,
    fontSize: '1rem',
    lineHeight: 1.3,
    color: 'var(--neon-pink)',
    margin: 0,
  };

  const descriptionStyle: CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontWeight: 400,
    fontSize: '15px',
    lineHeight: 1.6,
    color: 'var(--muted-fg)',
    margin: 0,
    whiteSpace: 'pre-line',
  };

  const highlightItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    lineHeight: 1.55,
    color: 'var(--muted-fg)',
  };

  const highlightDotStyle: CSSProperties = {
    marginTop: '6px',
    display: 'inline-block',
    width: '6px',
    height: '6px',
    flexShrink: 0,
    borderRadius: 'var(--radius-full)',
    background: 'var(--neon-cyan)',
    boxShadow: '0 0 6px var(--neon-cyan)',
  };

  return (
    <GlowCard accent={left ? 'pink' : 'cyan'}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {dateRange ? (
          <p style={dateStyle}>{dateRange}</p>
        ) : null}

        {role ? (
          <h3 style={roleStyle}>{role}</h3>
        ) : null}

        {company ? (
          <p className="tmpl-glow-pink" style={companyStyle}>{company}</p>
        ) : null}

        {description ? (
          <p style={descriptionStyle}>{description}</p>
        ) : null}

        {highlights.length > 0 ? (
          <ul
            style={{
              listStyle: 'none',
              margin: '8px 0 0',
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {highlights.map((h, hi) => (
              <li key={hi} style={highlightItemStyle}>
                <span aria-hidden="true" style={highlightDotStyle} />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </GlowCard>
  );
}

// ---------------------------------------------------------------------------
// Section root
// ---------------------------------------------------------------------------

export function Experience({ section }: SectionProps) {
  const content = (section?.content ?? null) as ExperienceContent | null;
  if (!content) return null;

  // hide-if-empty: only entries with a company OR a role survive; none → hide.
  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.company) || present(it?.role))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Timeline.exe';

  return (
    <div
      className="tmpl-shell"
      style={{
        ...sectionShellStyle,
        gap: '0',
      }}
    >
      <SectionHeading
        eyebrow="// EXPERIENCE"
        title={heading}
        accent="pink"
        align="center"
      />

      {/* Vertical timeline container — the spine lives here as an absolutely-positioned
          gradient rule. On mobile it's at left:0 (inside the padding); on md+ it's
          centered (left:50%). Items alternate left/right on md+ via CSS grid. */}
      <div style={{ position: 'relative' }}>
        {/* Neon gradient spine — full height of this container. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '0',
            top: 0,
            bottom: 0,
            width: '2px',
            background: 'var(--neon-gradient)',
            boxShadow: '0 0 8px color-mix(in oklab, var(--neon-pink) 50%, transparent)',
          }}
          className="tmpl-experience-spine"
        />

        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '48px',
          }}
        >
          {items.map((item, i) => {
            const left = i % 2 === 0;
            return (
              <ScrollReveal key={present(item.id) ? item.id : `${item.company}-${item.role}-${i}`} as="li" delay={i * 50}>
                <div
                  className={left ? 'tmpl-exp-item tmpl-exp-left' : 'tmpl-exp-item tmpl-exp-right'}
                  style={{
                    position: 'relative',
                    /* Mobile: single column, left-aligned with padding for the spine. */
                    paddingLeft: '32px',
                  }}
                >
                  {/* Neon node marker on the spine — neon-pink glowing dot. */}
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: '-7px',
                      top: '24px',
                      width: '14px',
                      height: '14px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--neon-pink)',
                      boxShadow:
                        '0 0 0 3px var(--bg), 0 0 12px var(--neon-pink), 0 0 24px color-mix(in oklab, var(--neon-pink) 50%, transparent)',
                      zIndex: 1,
                    }}
                    className="tmpl-exp-node"
                  />

                  <ExperienceCard item={item} left={left} />
                </div>
              </ScrollReveal>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
