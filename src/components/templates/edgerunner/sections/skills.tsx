/**
 * Skills section (edgerunner section 6) — THE SIGNATURE (D-09). Translated from the
 * export's `synthwave-founder/src/components/sections/Tools.tsx` (tools → skills, D-08).
 * Where minimal/editorial render tier PILLS, edgerunner renders animated LEVEL BARS
 * driven by the optional `skills.level` (0–100) field — its defining look.
 *
 * Mirrors the FROZEN `SectionProps` contract + `present()` + content cast + null-guard +
 * hide-if-empty. `index.tsx` wraps this in `<ScrollReveal as="section">`, so this
 * renders the INNER content. Casts `section.content` to `SkillsContent`
 * (`{ heading, groups: [{ label, items: [{ name, icon?, tier?, level? }] }] }`).
 *
 * RENDER CONTRACT (D-09):
 *   - mono `06 / skills` kicker + the heading.
 *   - each group rendered ONLY when it has ≥1 item (hide-if-empty).
 *   - per item: an optional brand logo (the curated simple-icons `.path`, monochrome
 *     neon-cyan at rest), the skill name, and:
 *       · if `level` (0–100 int) is present → an animated NEON BAR (the fill width is
 *         `level%`; the `.tmpl-skill-bar-fill` class owns the in-view width transition
 *         theme.css defines; under reduced-motion the fill renders at its final width
 *         with no transition — never stuck empty).
 *       · if `level` is ABSENT but `tier` is present → a tasteful tier PILL fallback
 *         (so a skill without a level still reads, and switching from minimal is
 *         lossless — D-08); never crashes on a missing level.
 *
 * NULL-GUARD: `level` is clamped to 0–100 and only treated as present when it is a
 * finite number (the Zod gate already enforces int 0–100, but every view column is
 * nullable so we re-guard defensively).
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css
 * (the bar gradient is `--neon-gradient`). The `.path` ships ZERO client JS (server
 * render); no user/seed string is interpolated into the SVG `d` (T-13-04-XSS).
 */
import type { SectionProps } from './types';
import type { SkillsContent } from '@/lib/validations';
import { TECH_ICONS } from './icons';
import { present } from './shared';

/** Human-readable, capitalized tier label for the pill fallback. */
const TIER_LABEL: Record<'core' | 'proficient' | 'learning', string> = {
  core: 'Core',
  proficient: 'Proficient',
  learning: 'Learning',
};

/**
 * A single brand logo: the curated simple-icons `.path` rendered inside our OWN `<svg>`.
 * `currentColor` makes it monochrome at rest (inherits the neon-cyan tint on the
 * wrapper). Returns `null` for an unknown slug (the skill name still renders).
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

/** A tier pill fallback for skills without a numeric `level` (lossless from minimal). */
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
        fontSize: '14px',
        fontWeight: 400,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        lineHeight: 1.3,
        background: 'var(--surface-muted)',
        color: isCore ? 'var(--neon-yellow)' : 'var(--muted-fg)',
        border: isCore ? '1px solid var(--neon-yellow)' : '1px solid var(--border)',
      }}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

/**
 * Clamp a nullable level to a finite 0–100 int, or `null` when absent/invalid.
 * The Zod gate already enforces int 0–100; this is the defensive nullable re-guard.
 */
function clampLevel(level: number | null | undefined): number | null {
  if (typeof level !== 'number' || !Number.isFinite(level)) return null;
  return Math.max(0, Math.min(100, Math.round(level)));
}

export function Skills({ section }: SectionProps) {
  const content = (section?.content ?? null) as SkillsContent | null;
  if (!content) return null;

  // hide-if-empty: only groups that actually have ≥1 item survive.
  const groups = Array.isArray(content.groups)
    ? content.groups.filter((g) => Array.isArray(g?.items) && g.items.length > 0)
    : [];
  if (groups.length === 0) return null;

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
      {/* Mono section label `06 / skills` (neon-cyan CRT label). */}
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
        06 / skills
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

      {/* The grouped competencies — each with a neon-bar list (the signature). */}
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
                    fontSize: '16px',
                    fontWeight: 400,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--muted-fg)',
                    margin: 0,
                  }}
                >
                  {groupLabel}
                </h3>
              ) : null}

              {/* Responsive bar grid — reflows from 1 col (mobile) to 2 (desktop). */}
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '16px 32px',
                }}
              >
                {items.map((item, ii) => {
                  const slug = present(item.icon) ? item.icon : null;
                  const level = clampLevel(item.level);
                  const tier = item.tier as
                    | 'core'
                    | 'proficient'
                    | 'learning'
                    | undefined;
                  return (
                    <li
                      key={`${item.name}-${ii}`}
                      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                    >
                      {/* The name row — logo + name + (level % or tier pill). */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          minHeight: '24px',
                        }}
                      >
                        {slug ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              color: 'var(--neon-cyan)',
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

                        {level !== null ? (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '16px',
                              color: 'var(--muted-fg)',
                              fontVariantNumeric: 'tabular-nums',
                              flex: '0 0 auto',
                            }}
                          >
                            {level}%
                          </span>
                        ) : tier ? (
                          <TierPill tier={tier} />
                        ) : null}
                      </div>

                      {/* The neon bar — rendered ONLY when a level is present (the
                          signature, D-09). The fill width is `level%`; the
                          `.tmpl-skill-bar-fill` class owns the in-view transition
                          (theme.css), reduced-motion-zeroed (renders at final width). */}
                      {level !== null ? (
                        <div
                          className="tmpl-skill-bar-track"
                          role="progressbar"
                          aria-valuenow={level}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${item.name} proficiency`}
                        >
                          <span
                            className="tmpl-skill-bar-fill tmpl-reveal"
                            style={{ width: `${level}%` }}
                          />
                        </div>
                      ) : null}
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
