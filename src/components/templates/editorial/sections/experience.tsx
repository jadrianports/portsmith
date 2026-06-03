/**
 * Experience section (D-P7-10 section 5) — the Newsprint ruled ledger (07-UI-SPEC A.7
 * §5). Mirrors `minimal/sections/experience.tsx`'s FROZEN `SectionProps` contract +
 * `present()` + content cast + null-guard + hide-if-empty + the date formatting
 * (YYYY-MM → YYYY, `present` → "Present") EXACTLY; the visual body is the editorial
 * ledger. `index.tsx` wraps this in `<ScrollReveal as="section">`, so this renders the
 * section's INNER content.
 *
 * RENDER CONTRACT (A.7 §5): a RULED LEDGER (Swiss table rhythm) over
 * `ExperienceContent.items` — per item a block with company + role (Space Grotesk
 * 600), MONO `start_date — end_date` (`present` → "Present", `tnum`, e.g.
 * `2023 — Present`), the description (Body), separated by decorative hairline rules,
 * baseline-aligned.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 * React escapes all seeded text by default (no `dangerouslySetInnerHTML`).
 */
import type { SectionProps } from './types';
import type { ExperienceContent, ExperienceItem } from '@/lib/validations';

/** A string field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Mono kicker label — uppercase JetBrains Mono. */
const kickerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  fontWeight: 500,
  lineHeight: 1.4,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: 'var(--muted-fg)',
  margin: 0,
};

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
 * Build the displayed date range, e.g. `2020 — Present`, `2018 — 2021`, or just
 * `2020` when there is no end date. Returns `null` when there is no start date.
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
        // Decorative hairline separator between entries (not after the last).
        borderBottom: last ? 'none' : '1px solid var(--border)',
      }}
    >
      {/* Mono date range (tnum) — the muted meta line. */}
      {dateRange ? (
        <p
          style={{
            ...kickerStyle,
            fontFeatureSettings: '"tnum"',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {dateRange}
        </p>
      ) : null}

      {/* Role (primary) + company — Space Grotesk 600. */}
      {role ? (
        <h3
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: '1.25rem',
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
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: '1.25rem',
            lineHeight: 1.2,
            color: 'var(--fg)',
            margin: 0,
          }}
        >
          {company}
        </h3>
      ) : null}

      {/* Description — Body, honoring paragraph breaks. */}
      {description ? (
        <p
          className="tmpl-measure"
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize: '18px',
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
  // Cast the validated JSONB content; null-guard the row + every field.
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
      {/* Mono kicker `05 — EXPERIENCE` above an ink rule. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={kickerStyle}>05 — Experience</p>
        <div
          aria-hidden="true"
          style={{ height: '1px', width: '100%', background: 'var(--fg)' }}
        />
      </div>

      {/* Section heading (Fraunces, ink — not the accent). */}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 'clamp(1.5rem, 3vw, 2rem)',
          lineHeight: 1.15,
          color: 'var(--fg)',
          margin: 0,
        }}
      >
        {heading}
      </h2>

      {/* Ruled ledger — hairline separators between entries, baseline-aligned. */}
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
