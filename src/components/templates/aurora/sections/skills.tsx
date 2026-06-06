/**
 * Skills section (aurora section 8) — the rosy competency pills (translated from
 * `marketing-girl/src/components/Skills.tsx`). Mirrors the FROZEN `SectionProps` contract
 * + `present()` + content cast + null-guard + hide-if-empty EXACTLY. `index.tsx` wraps
 * this in `<ScrollReveal as="section">`, so this renders the INNER content.
 *
 * Casts `section.content` to `SkillsContent` (`{ heading, groups: [{ label, items: [{
 * name, icon?, tier? }] }] }`).
 *
 * RENDER CONTRACT: a mono kicker + heading, then labeled groups — each a small mono label
 * over a soft hairline, then its items as rounded pills. Tech-stack items with an `icon`
 * slug in `TECH_ICONS` render the MONOCHROME `BrandLogo` (server-rendered, zero client
 * JS) + the label. Tier markers are tasteful labels ("Core" = rose), NEVER % gauges
 * (D-09). The source's framer-motion + progress bars are DROPPED.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import type { SectionProps } from './types';
import type { SkillsContent } from '@/lib/validations';
import { TECH_ICONS } from './icons';
import { hairlineStyle, headingStyle, kickerStyle, present, sectionShellStyle } from './shared';

/** Human-readable, capitalized tier label for the marker (NEVER a % gauge). */
const TIER_LABEL: Record<'core' | 'proficient' | 'learning', string> = {
  core: 'Core',
  proficient: 'Proficient',
  learning: 'Learning',
};

/**
 * A single brand logo: the curated simple-icons `.path` rendered inside our OWN `<svg>`.
 * `currentColor` makes it MONOCHROME at rest (inherits the color set on the wrapper); the
 * `aria-label` is the required accessible name. Returns `null` for an unknown slug.
 */
function BrandLogo({ slug }: { slug: string }) {
  const icon = TECH_ICONS[slug];
  if (!icon) return null;
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={icon.title} width="18" height="18" fill="currentColor">
      <path d={icon.path} />
    </svg>
  );
}

/** A rounded tier pill — rose for "Core", muted for the rest (D-09). No % gauges. */
function TierMarker({ tier }: { tier: 'core' | 'proficient' | 'learning' }) {
  const isCore = tier === 'core';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 'var(--radius-full)',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        fontWeight: 400,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        lineHeight: 1.4,
        color: isCore ? 'var(--accent)' : 'var(--muted-fg)',
        border: isCore ? '1px solid var(--accent)' : '1px solid var(--border)',
      }}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

export function Skills({ section }: SectionProps) {
  const content = (section?.content ?? null) as SkillsContent | null;
  if (!content) return null;

  const groups = Array.isArray(content.groups)
    ? content.groups.filter((g) => Array.isArray(g?.items) && g.items.length > 0)
    : [];
  if (groups.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Skills';

  return (
    <div className="tmpl-shell" style={sectionShellStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={kickerStyle}>Skills</p>
        <div aria-hidden="true" style={hairlineStyle} />
      </div>

      <h2 style={headingStyle}>{heading}</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {groups.map((group, gi) => {
          const items = group.items.filter((it) => present(it?.name));
          if (items.length === 0) return null;
          const groupLabel = present(group.label) ? group.label : null;

          return (
            <div
              key={`${groupLabel ?? 'group'}-${gi}`}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {groupLabel ? (
                <h3 style={{ ...kickerStyle, color: 'var(--muted-fg)' }}>{groupLabel}</h3>
              ) : null}

              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                {items.map((item, ii) => {
                  const slug = present(item.icon) ? item.icon : null;
                  const tier = item.tier as 'core' | 'proficient' | 'learning' | undefined;
                  return (
                    <li
                      key={`${item.name}-${ii}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--surface-muted)',
                        border: '1px solid var(--border)',
                        minHeight: '44px',
                      }}
                    >
                      {slug ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            color: 'var(--accent)',
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
                          fontSize: '15px',
                          lineHeight: 1.4,
                          color: 'var(--fg)',
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
