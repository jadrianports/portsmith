/**
 * Experience section (D-05 section 5) — UI-SPEC §"5. Experience". Replaces the
 * 03-04 stub: the body is real, the SHARED `SectionProps` signature, the export
 * name, and the `index.tsx` wiring are UNCHANGED (frozen 03-04 contract —
 * `index.tsx` is NOT edited, no new prop). `index.tsx` already wraps this in
 * `<ScrollReveal as="section">`, so this renders the section's INNER content (no
 * `<section>` of its own).
 *
 * RENDER CONTRACT (UI-SPEC §5):
 *   - mono `05 / experience` label + the heading.
 *   - a clean, restrained VERTICAL TIMELINE over `ExperienceContent.items` (a left
 *     hairline rail + a small node per entry — no heavy ornament).
 *   - per item: company, role, MONO dates, and the description (Body 16/1.6).
 *   - dates render in JetBrains Mono with `font-feature-settings: "tnum"` (tabular
 *     figures). The `YYYY-MM` values are formatted for display to the YEAR
 *     (e.g. `2023 — Present`); the literal `'present'` end_date renders as
 *     "Present", and an empty/absent end_date renders just the start year.
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
  // YYYY-MM → YYYY (the leading 4 digits); fall back to the raw value if unexpected.
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
        // Room for the rail + node on the left (the rail lives on the parent <ol>).
        paddingLeft: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Timeline node — a small dot on the rail. Decorative; cyan accent at low key. */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-5px',
          top: '6px',
          width: '10px',
          height: '10px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--accent-cyan)',
          boxShadow: '0 0 0 4px var(--bg)',
        }}
      />

      {/* Mono date range (tnum) — the muted meta line. */}
      {dateRange ? (
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            fontWeight: 500,
            lineHeight: 1.4,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--muted-fg)',
            fontFeatureSettings: '"tnum"',
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
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        padding: '64px 0',
        maxWidth: '72ch',
      }}
    >
      {/* Mono section label `05 / experience` (cyan, per the section precedent). */}
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          fontWeight: 500,
          lineHeight: 1.4,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--accent-cyan)',
          margin: 0,
        }}
      >
        05 / experience
      </p>

      {/* Section heading (Clash Display Heading scale, foreground — not gradient). */}
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

      {/* Vertical timeline — a left hairline rail (the ol's left border) with a node
          + entry per item. Restrained, no heavy ornament (UI-SPEC §5). */}
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          paddingLeft: '4px',
          borderLeft: '1px solid var(--border)',
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
