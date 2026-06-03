/**
 * Skills section (D-P7-10 section 3) — the Newsprint labeled column groups (07-UI-SPEC
 * A.7 §3; D-08/D-09). Mirrors `minimal/sections/skills.tsx`'s FROZEN `SectionProps`
 * contract + `present()` + content cast + null-guard + hide-if-empty EXACTLY; the
 * visual body is the editorial layout. `index.tsx` wraps this in `<ScrollReveal
 * as="section">`, so this renders the section's INNER content.
 *
 * Casts `section.content` to `SkillsContent` (`{ heading, groups: [{ label, items:
 * [{ name, icon?, tier? }] }] }`).
 *
 * RENDER CONTRACT (A.7 §3):
 *   - mono `03 — SKILLS` kicker above an ink rule + the heading (Fraunces).
 *   - LABELED COLUMN GROUPS (Swiss): each group (`label`) is a small mono header
 *     above an ink rule, then its items; render a group only when it has >=1 item.
 *   - tech-stack items with an `icon` slug in the curated `TECH_ICONS` map render the
 *     MONOCHROME-INK `BrandLogo` (`.path` in our OWN `<svg viewBox="0 0 24 24"
 *     role="img" aria-label fill="currentColor">`) — flat, no chroma wall — + the
 *     label; each logo carries an accessible name. Server Component ⇒ ZERO client JS.
 *   - tier markers as near-square labels: "Core" = VERMILION, Proficient/Learning =
 *     muted ink. NEVER numeric/percentage gauges (D-09).
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import type { SectionProps } from './types';
import type { SkillsContent } from '@/lib/validations';
import { TECH_ICONS } from './icons';

/** A string field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Human-readable, capitalized tier label for the marker (NEVER a % gauge). */
const TIER_LABEL: Record<'core' | 'proficient' | 'learning', string> = {
  core: 'Core',
  proficient: 'Proficient',
  learning: 'Learning',
};

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
 * A single brand logo: the curated simple-icons `.path` rendered inside our OWN
 * `<svg>`. `currentColor` makes it MONOCHROME INK at rest (inherits the ink color set
 * on the wrapper); the `aria-label` is the required accessible name. Returns `null`
 * for an unknown slug (the skill name still renders) — never throws.
 */
function BrandLogo({ slug }: { slug: string }) {
  const icon = TECH_ICONS[slug];
  if (!icon) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={icon.title}
      width="20"
      height="20"
      fill="currentColor"
      aria-hidden={false}
    >
      <path d={icon.path} />
    </svg>
  );
}

/**
 * A near-square tier marker — VERMILION for "Core", muted ink for the rest (D-09).
 * Editorial = square (radius-sm), uppercase mono. No fills, no % gauges.
 */
function TierMarker({ tier }: { tier: 'core' | 'proficient' | 'learning' }) {
  const isCore = tier === 'core';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        lineHeight: 1.4,
        // The "Core" marker uses the vermilion accent (per the A.4 reserved-for list);
        // Proficient / Learning stay neutral-muted. No fills, no % gauges (D-09).
        color: isCore ? 'var(--accent)' : 'var(--muted-fg)',
        border: isCore ? '1px solid var(--accent)' : '1px solid var(--border)',
      }}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

export function Skills({ section }: SectionProps) {
  // Cast the validated JSONB content; null-guard the row + every field.
  const content = (section?.content ?? null) as SkillsContent | null;
  if (!content) return null;

  // hide-if-empty: only groups that actually have >=1 item survive.
  const groups = Array.isArray(content.groups)
    ? content.groups.filter((g) => Array.isArray(g?.items) && g.items.length > 0)
    : [];
  if (groups.length === 0) return null; // nothing to render → hide the whole section

  const heading = present(content.heading) ? content.heading : 'Skills';

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
      {/* Mono kicker `03 — SKILLS` above an ink rule. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={kickerStyle}>03 — Skills</p>
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

      {/* The grouped competencies as labeled columns (each rendered only with items). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {groups.map((group, gi) => {
          const items = group.items.filter((it) => present(it?.name));
          if (items.length === 0) return null; // belt-and-suspenders hide-if-empty
          const groupLabel = present(group.label) ? group.label : null;

          return (
            <div
              key={`${groupLabel ?? 'group'}-${gi}`}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {/* Group mono header above an ink rule (the Swiss column-group label). */}
              {groupLabel ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h3 style={kickerStyle}>{groupLabel}</h3>
                  <div
                    aria-hidden="true"
                    style={{ height: '1px', width: '100%', background: 'var(--border)' }}
                  />
                </div>
              ) : null}

              {/* Responsive item grid — auto-fill reflows from 1 col (mobile) up to
                  several columns (desktop) with no media query. */}
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '8px',
                }}
              >
                {items.map((item, ii) => {
                  const slug = present(item.icon) ? item.icon : null;
                  const tier = item.tier as
                    | 'core'
                    | 'proficient'
                    | 'learning'
                    | undefined;
                  return (
                    <li
                      key={`${item.name}-${ii}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-muted)',
                        border: '1px solid var(--border)',
                        minHeight: '44px', // touch target
                      }}
                    >
                      {/* Brand logo: MONOCHROME INK at rest (currentColor = --fg). */}
                      {slug ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            color: 'var(--fg)',
                            flex: '0 0 auto',
                          }}
                        >
                          <BrandLogo slug={slug} />
                        </span>
                      ) : null}

                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontWeight: 400,
                          fontSize: '16px',
                          lineHeight: 1.4,
                          color: 'var(--fg)',
                          flex: '1 1 auto',
                        }}
                      >
                        {item.name}
                      </span>

                      {tier ? <TierMarker tier={tier} /> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
