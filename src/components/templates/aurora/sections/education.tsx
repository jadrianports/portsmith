/**
 * Education section (aurora — NEW marketer-vertical type, 11-04 Step C1). Translated from
 * `marketing-girl/src/components/Education.tsx`. A FIRST-CLASS mapped soft-enum type (the
 * live closed set is 13; `education` is in `sectionContentSchemas`). Mirrors the FROZEN
 * `SectionProps` contract + `present()` + content cast + null-guard + hide-if-empty.
 * `index.tsx` wraps this in `<ScrollReveal as="section">`, so this renders the INNER content.
 *
 * Casts `section.content` to `EducationContent` (`{ heading, items: [{ id, degree, school,
 * year?, achievements? }] }`).
 *
 * RENDER CONTRACT: a mono kicker + heading, then a ruled ledger of degree entries — per
 * item the degree (Poppins 500), the school + optional year (mono meta), and an optional
 * achievements bullet list. Separated by soft hairline rules. Profession-agnostic: a
 * marketer's certificate programme reads as cleanly as a developer's degree.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import type { SectionProps } from './types';
import type { EducationContent, EducationItem } from '@/lib/validations';
import { hairlineStyle, headingStyle, kickerStyle, present, sectionShellStyle } from './shared';

/** A single education entry — degree, school + year meta, optional achievements. */
function EducationEntry({ item, last }: { item: EducationItem; last: boolean }) {
  const degree = present(item.degree) ? item.degree : null;
  const school = present(item.school) ? item.school : null;
  const year = present(item.year) ? item.year : null;
  const achievements = Array.isArray(item.achievements)
    ? item.achievements.filter((a) => present(a))
    : [];

  // A meaningful entry needs at least a degree or a school.
  if (!degree && !school) return null;

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
      {year ? (
        <p
          style={{
            ...kickerStyle,
            color: 'var(--muted-fg)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {year}
        </p>
      ) : null}

      {degree ? (
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
          {degree}
        </h3>
      ) : null}

      {school ? (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: '15px',
            lineHeight: 1.4,
            color: 'var(--muted-fg)',
            margin: 0,
          }}
        >
          {school}
        </p>
      ) : null}

      {achievements.length > 0 ? (
        <ul
          style={{
            listStyle: 'disc',
            margin: '4px 0 0',
            paddingInlineStart: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {achievements.map((a, ai) => (
            <li
              key={`${a}-${ai}`}
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: '15px',
                lineHeight: 1.5,
                color: 'var(--muted-fg)',
              }}
            >
              {a}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function Education({ section }: SectionProps) {
  const content = (section?.content ?? null) as EducationContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.degree) || present(it?.school))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Education';

  return (
    <div className="tmpl-shell" style={sectionShellStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={kickerStyle}>Education</p>
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
          <EducationEntry
            key={present(item.id) ? item.id : `${item.degree}-${item.school}-${i}`}
            item={item}
            last={i === items.length - 1}
          />
        ))}
      </ol>
    </div>
  );
}
