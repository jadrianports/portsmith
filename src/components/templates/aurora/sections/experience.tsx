/**
 * Experience section (aurora section 4) — the rosy ledger (translated from
 * `marketing-girl/src/components/Experience.tsx`). Mirrors the FROZEN `SectionProps`
 * contract + `present()` + content cast + null-guard + hide-if-empty + the date
 * formatting (YYYY-MM → YYYY, `present` → "Present") EXACTLY. `index.tsx` wraps this in
 * `<ScrollReveal as="section">`, so this renders the INNER content.
 *
 * Casts `section.content` to `ExperienceContent` (`{ heading, items: [{ company, role,
 * start_date, end_date, description }] }`).
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import type { SectionProps } from './types';
import type { ExperienceContent, ExperienceItem } from '@/lib/validations';
import { hairlineStyle, headingStyle, kickerStyle, present, sectionShellStyle } from './shared';

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

/** A single ledger entry — mono dates, role + company, description, hairline rule. */
function ExperienceEntry({ item, last }: { item: ExperienceItem; last: boolean }) {
  const company = present(item.company) ? item.company : null;
  const role = present(item.role) ? item.role : null;
  const dateRange = formatRange(item.start_date, item.end_date);
  const description = present(item.description) ? item.description : null;

  return (
    <li
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingBottom: last ? 0 : '24px',
        borderBottom: last ? 'none' : '1px solid var(--border)',
      }}
    >
      {dateRange ? (
        <p
          style={{
            ...kickerStyle,
            color: 'var(--muted-fg)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {dateRange}
        </p>
      ) : null}

      {role ? (
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
            fontWeight: 500,
            fontSize: '1.25rem',
            lineHeight: 1.25,
            color: 'var(--fg)',
            margin: 0,
          }}
        >
          {company}
        </h3>
      ) : null}

      {description ? (
        <p
          className="tmpl-measure"
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '17px',
            lineHeight: 1.6,
            color: 'var(--muted-fg)',
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

  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.company) || present(it?.role))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Experience';

  return (
    <div className="tmpl-shell" style={sectionShellStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={kickerStyle}>Experience</p>
        <div aria-hidden="true" style={hairlineStyle} />
      </div>

      <h2 style={headingStyle}>{heading}</h2>

      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {items.map((item, i) => (
          <ExperienceEntry
            key={present(item.id) ? item.id : `${item.company}-${item.role}-${i}`}
            item={item}
            last={i === items.length - 1}
          />
        ))}
      </ol>
    </div>
  );
}
