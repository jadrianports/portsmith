/**
 * Skills section (D-05 section 3) — the deliberate standout (UI-SPEC §"3. Skills";
 * D-08/D-09). Replaces the 03-04 stub: the body is real, the SHARED `SectionProps`
 * signature, the export name, and the `index.tsx` wiring are UNCHANGED (frozen
 * 03-04 contract — `index.tsx` is NOT edited, no new prop). `index.tsx` already
 * wraps this in `<ScrollReveal as="section">`, so this renders the section's INNER
 * content (no `<section>` of its own).
 *
 * FIRST LIVE USE of the new `skills` soft-enum type (the CMS-08 "new type, no
 * migration" proof, 03-01): casts `section.content` to `SkillsContent`
 * (`{ heading, groups: [{ label, items: [{ name, icon?, tier? }] }] }`).
 *
 * RENDER CONTRACT (UI-SPEC §3):
 *   - mono `03 / skills` label + the heading.
 *   - the three groups (Core Competencies / Tech Stack / Currently Learning)
 *     rendered from `content.groups`, each ONLY when it has ≥1 item (hide-if-empty).
 *   - a responsive logo grid: for each item with an `icon` slug present in the
 *     curated `TECH_ICONS` map, a `BrandLogo` renders the simple-icons `.path`
 *     inside its OWN `<svg viewBox="0 0 24 24" role="img" aria-label fill="currentColor">`
 *     — monochrome / low-chroma at rest (cyan-tinted via `--accent-cyan`, NOT
 *     magenta), each with an accessible name. Server Component ⇒ the `.path` data
 *     ships ZERO client JS (T-03-18).
 *   - tier labels render as small TEXT pills (Core · Proficient · Learning); the
 *     "Core" pill uses the gold detail token (`--accent-gold`). NEVER numeric /
 *     percentage gauges (D-09).
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

/** Human-readable, capitalized tier label for the text pill (NEVER a % gauge). */
const TIER_LABEL: Record<'core' | 'proficient' | 'learning', string> = {
  core: 'Core',
  proficient: 'Proficient',
  learning: 'Learning',
};

/**
 * A single brand logo: the curated simple-icons `.path` rendered inside our OWN
 * `<svg>`. `currentColor` makes it monochrome at rest (inherits the cyan-tinted
 * color set on the wrapper); the `aria-label` is the required accessible name.
 * Returns `null` for an unknown slug (the skill name still renders) — never throws.
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

/** A tasteful text tier pill — gold marker for "Core", muted for the rest (D-09). */
function TierPill({ tier }: { tier: 'core' | 'proficient' | 'learning' }) {
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
        letterSpacing: '0.12em',
        lineHeight: 1.4,
        background: 'var(--surface-muted)',
        // The "Core" marker uses the gold detail token (per the reserved-for list);
        // Proficient / Learning stay neutral-muted. No fills, no % gauges (D-09).
        color: isCore ? 'var(--accent-gold)' : 'var(--muted-fg)',
        border: isCore
          ? '1px solid var(--accent-gold)'
          : '1px solid var(--border)',
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

  // hide-if-empty: only groups that actually have ≥1 item survive.
  const groups = Array.isArray(content.groups)
    ? content.groups.filter((g) => Array.isArray(g?.items) && g.items.length > 0)
    : [];
  if (groups.length === 0) return null; // nothing to render → hide the whole section

  const heading = present(content.heading) ? content.heading : 'Skills';

  return (
    <div
      // `.tmpl-shell`: the shared centered max-width + horizontal gutter (theme.css).
      // The prior inline `maxWidth: 72ch` is dropped in favor of the uniform shell
      // width so Skills aligns with the other shelled sections (no off-width column).
      className="tmpl-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        paddingBlock: '64px',
      }}
    >
      {/* Mono section label `03 / skills` (cyan, per the hero precedent). */}
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
        03 / skills
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

      {/* The three grouped competencies (each rendered only when it has items). */}
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
              {groupLabel ? (
                <h3
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--muted-fg)',
                    margin: 0,
                  }}
                >
                  {groupLabel}
                </h3>
              ) : null}

              {/* Responsive item grid — auto-fill so it reflows from 1 col (mobile)
                  up to several columns (desktop) with no media-query gymnastics. */}
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
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
                      {/* Brand logo: monochrome at rest (cyan-tinted via color),
                          brand color is intentionally NOT shipped per-item. */}
                      {slug ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            color: 'var(--accent-cyan)',
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

                      {tier ? <TierPill tier={tier} /> : null}
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
