/**
 * Experience section (edgerunner section 4) — the synthwave timeline (translated from
 * `synthwave-founder/src/components/sections/Experience.tsx`; "timeline" is a
 * render-style, not a new type — D-08, it maps to `experience`). Mirrors the FROZEN
 * `SectionProps` contract + `present()` + content cast + null-guard + hide-if-empty.
 * `index.tsx` wraps this in `<ScrollReveal as="section">`, so this renders the INNER
 * content.
 *
 * RENDER CONTRACT:
 *   - mono `04 / experience` kicker + the heading.
 *   - a clean VERTICAL TIMELINE over `ExperienceContent.items` (a left neon rail + a
 *     small neon node per entry).
 *   - per item: company, role, MONO dates, and the description (Body 16/1.6).
 *   - dates render in VT323 with tabular figures; `YYYY-MM` formats to the YEAR
 *     (e.g. `2023 — Present`); literal `'present'` → "Present"; empty end → start only.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 * React escapes all seeded text by default (no `dangerouslySetInnerHTML`).
 */
import type { SectionProps } from './types';
import type { ExperienceContent, ExperienceItem } from '@/lib/validations';
import { present } from './shared';

/**
 * Format a single date value for display.
 * - `'present'` (case-insensitive) → "Present".
 * - a `YYYY-MM` string → its `YYYY` year (the design shows the year, not the month).
 * - empty / absent → `null` (the caller omits the end side).
 */
function formatDatePart(value: string | null | undefined): string | null {
  if (!present(value)) return null;
  const v = value.trim();
  if (v.toLowerCase() === 'present') return 'Present';
  const match = /^(\d{4})-\d{2}$/.exec(v);
  return match ? match[1] : v;
}

/**
 * Build the displayed date range, e.g. `2020 — Present`, `2018 — 2021`, or just `2020`
 * when there is no end date. Returns `null` when there is no start date.
 */
function formatRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  const startPart = formatDatePart(start);
  if (!startPart) return null;
  const endPart = formatDatePart(end);
  return endPart ? `${startPart} — ${endPart}` : startPart;
}

/** A single timeline entry — company, role, mono dates, description. */
function ExperienceEntry({ item }: { item: ExperienceItem }) {
  const company = present(item.company) ? item.company : null;
  const role = present(item.role) ? item.role : null;
  const dateRange = formatRange(item.start_date, item.end_date);
  const description = present(item.description) ? item.description : null;

  return (
    <li
      style={{
        position: 'relative',
        paddingLeft: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Timeline node — a small neon-cyan dot on the rail. */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-5px',
          top: '6px',
          width: '10px',
          height: '10px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--neon-cyan)',
          boxShadow: '0 0 0 4px var(--bg), 0 0 10px var(--neon-cyan)',
        }}
      />

      {/* Mono date range (tabular) — the muted meta line. */}
      {dateRange ? (
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '16px',
            fontWeight: 400,
            lineHeight: 1.3,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--muted-fg)',
            fontVariantNumeric: 'tabular-nums',
            margin: 0,
          }}
        >
          {dateRange}
        </p>
      ) : null}

      {/* Role (the primary line) + company. */}
      {role ? (
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '1.125rem',
            lineHeight: 1.2,
            color: 'var(--fg)',
            margin: 0,
          }}
        >
          {role}
          {company ? (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: '1rem',
                color: 'var(--muted-fg)',
              }}
            >
              {' · '}
              {company}
            </span>
          ) : null}
        </h3>
      ) : company ? (
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '1.125rem',
            lineHeight: 1.2,
            color: 'var(--fg)',
            margin: 0,
          }}
        >
          {company}
        </h3>
      ) : null}

      {/* Description (Body 16/1.6), honoring paragraph breaks. */}
      {description ? (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: 1.6,
            color: 'var(--muted-fg)',
            maxWidth: '65ch',
            margin: 0,
            whiteSpace: 'pre-line',
          }}
        >
          {description}
        </p>
      ) : null}
    </li>
  );
}

export function Experience({ section }: SectionProps) {
  const content = (section?.content ?? null) as ExperienceContent | null;
  if (!content) return null;

  // hide-if-empty: only entries with a company OR a role survive; none → hide.
  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.company) || present(it?.role))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Experience';

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
      {/* Mono section label `04 / experience` (neon-cyan CRT label). */}
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '18px',
          fontWeight: 400,
          lineHeight: 1.2,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: 'var(--neon-cyan)',
          margin: 0,
        }}
      >
        04 / experience
      </p>

      {/* Section heading (Orbitron display, foreground — not gradient). */}
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

      {/* Vertical timeline — a left neon rail (the ol's left border) with a node + entry
          per item. */}
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          paddingLeft: '4px',
          borderLeft: '1px solid var(--border-strong)',
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
        }}
      >
        {items.map((item, i) => (
          <ExperienceEntry
            key={present(item.id) ? item.id : `${item.company}-${item.role}-${i}`}
            item={item}
          />
        ))}
      </ol>
    </div>
  );
}
