/**
 * Skills section (edgerunner section 6) — THE SIGNATURE (D-09).
 *
 * Faithfully clones `lovable-exports/synthwave-founder/src/components/sections/Tools.tsx`
 * (circular SVG gauges, grouped layout) + `TechMarquee.tsx` (infinite horizontal strip),
 * translated to the platform's data contract and conventions:
 *
 *   - R1  `motion/react` not used (gauge is CSS-only — no motion library needed).
 *   - R2  Casts `section.content` to `SkillsContent`; null-guards throughout.
 *   - R3  ALL colors via scoped `var(--token)` — no hardcoded hex.
 *   - R5  SSR renders gauges at their FINAL fill level (strokeDashoffset = C*(1-level/100)).
 *         The fill animation (C → offset) is a CSS-only progressive enhancement via
 *         `tmpl-gauge-arc` + `tmpl-edgerunner-gauge-fill` keyframe (theme.css).
 *         TechMarquee is CSS-only — no JS needed; static strip without animation.
 *   - R6  Server Component — no hooks, no event handlers, no browser-only APIs.
 *   - R7  Brand icons rendered as real `<svg><path d={path} />` — NOT dangerouslySetInnerHTML.
 *
 * GAUGE MATH (per export): R=32, C=2π*32≈201.06, viewBox="0 0 80 80" (cx=40 cy=40).
 *   - track circle: faint `var(--border)` fill.
 *   - progress circle: `var(--neon-cyan)` stroke, strokeDasharray=C,
 *     strokeDashoffset = C*(1 - level/100), rotate(-90 40 40), strokeLinecap="round".
 *   - SSR (no-JS-safe): strokeDashoffset={offset} (the FILLED value) as the static
 *     attribute — gauge is never empty. CSS animation plays C→offset on load; under
 *     reduced-motion the blanket reset zeroes it, leaving the gauge statically filled.
 *
 * MARQUEE: doubles the flattened skill list (icon + name + "/" separator) for a
 * seamless loop, driven by `tmpl-edgerunner-marquee` (defined in theme.css). No JS.
 * Reduced-motion zeros the marquee animation via the blanket reset in theme.css.
 *
 * Items WITHOUT a numeric `level`: rendered as an icon+name pill (no gauge, no crash).
 */

import type { SectionProps } from './types';
import type { SkillsContent } from '@/lib/validations';
import { TECH_ICONS } from './icons';
import { present, sectionShellStyle } from './shared';
import { SectionHeading } from './ui/section-heading';

// ── Gauge constants (faithful to the export's 72×72 viewBox, scaled to 80×80) ──
const R = 32;
const C = 2 * Math.PI * R; // ≈ 201.06

/**
 * Clamp a nullable level to a finite 0–100 int, or `null` when absent/invalid.
 * The Zod gate already enforces int 0–100; this is the defensive nullable re-guard.
 */
function clampLevel(level: number | null | undefined): number | null {
  if (typeof level !== 'number' || !Number.isFinite(level)) return null;
  return Math.max(0, Math.min(100, Math.round(level)));
}

/**
 * A single brand logo: curated simple-icons `.path` inside our OWN `<svg>`.
 * `currentColor` → monochrome at rest (inherits neon-cyan from wrapper).
 * Returns `null` for an unknown slug — skill name still renders (graceful).
 * R7: real `<svg><path>` element — NOT dangerouslySetInnerHTML.
 */
function BrandLogo({ slug, size = 18 }: { slug: string; size?: number }) {
  const icon = TECH_ICONS[slug];
  if (!icon) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={icon.title}
      width={size}
      height={size}
      fill="currentColor"
    >
      <path d={icon.path} />
    </svg>
  );
}

/**
 * A tier pill fallback for items without a numeric `level` — the lossless
 * cross-template path. Renders icon + name + optional tier tag as a horizontal pill.
 */
function SkillPill({
  name,
  iconSlug,
  tier,
}: {
  name: string;
  iconSlug: string | null;
  tier?: 'core' | 'proficient' | 'learning';
}) {
  const isCore = tier === 'core';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        borderRadius: 'var(--radius-full)',
        background: 'var(--surface-muted)',
        border: '1px solid var(--border)',
        minHeight: '44px',
        listStyle: 'none',
      }}
    >
      {iconSlug ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: 'var(--neon-cyan)',
            flex: '0 0 auto',
          }}
        >
          <BrandLogo slug={iconSlug} />
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
        {name}
      </span>
      {tier ? (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            color: isCore ? 'var(--neon-yellow)' : 'var(--muted-fg)',
            border: isCore ? '1px solid var(--neon-yellow)' : '1px solid var(--border)',
          }}
        >
          {tier}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A single circular SVG gauge for one skill item.
 *
 * SSR contract (R5): strokeDashoffset={offset} (the FILLED value) is the static
 * SVG attribute — SSR and no-JS both render the gauge filled to the skill's level.
 *
 * Animation: CSS-only via `tmpl-gauge-arc` class + `tmpl-edgerunner-gauge-fill`
 * keyframe in theme.css. The keyframe animates FROM `var(--gauge-c)` (empty) to the
 * element's own `strokeDashoffset` (offset/filled). Under `prefers-reduced-motion`,
 * the blanket reset in theme.css zeroes the animation — gauge stays statically filled.
 * No JS, no hooks, no IntersectionObserver required.
 *
 * Center content: brand icon (if slug known) + name + level% label (monochrome, readable).
 */
function Gauge({
  name,
  iconSlug,
  level,
}: {
  name: string;
  iconSlug: string | null;
  level: number;
}) {
  const offset = C * (1 - level / 100);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {/* SVG ring */}
      <div style={{ position: 'relative', width: '80px', height: '80px' }}>
        <svg
          viewBox="0 0 80 80"
          style={{ width: '100%', height: '100%' }}
          aria-hidden="true"
        >
          {/* Track (faint background ring) */}
          <circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            stroke="var(--border)"
            strokeWidth="5"
          />
          {/* Progress arc — SSR/no-JS: strokeDashoffset={offset} (FILLED value).
              CSS animation (tmpl-gauge-arc) plays C→offset on load as progressive enhancement. */}
          <circle
            cx="40"
            cy="40"
            r={R}
            fill="none"
            stroke="var(--neon-cyan)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            transform="rotate(-90 40 40)"
            className="tmpl-gauge-arc"
            style={{
              filter:
                'drop-shadow(0 0 6px color-mix(in oklab, var(--neon-cyan) 70%, transparent))',
              ['--gauge-c' as string]: String(C),
            }}
          />
        </svg>

        {/* Center icon (if brand logo found) */}
        {iconSlug ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              color: 'var(--fg)',
              opacity: 0.9,
            }}
          >
            <BrandLogo slug={iconSlug} size={22} />
          </div>
        ) : null}
      </div>

      {/* Name + level% label */}
      <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            fontWeight: 400,
            color: 'var(--fg)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            opacity: 0.9,
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--neon-cyan)',
          }}
          className="tmpl-glow-cyan"
        >
          {level}%
        </div>
      </div>
    </div>
  );
}

/**
 * TechMarquee — the infinite horizontal strip of skill names below the gauge groups.
 *
 * Pure CSS animation via `tmpl-edgerunner-marquee` (defined in theme.css). No JS.
 * The item list is DOUBLED so the -50% translateX loop is seamless. Left/right
 * fade masks are inline background-image (token-driven). Aria-hidden: the marquee
 * is decorative; all names appear in the gauge grid above.
 *
 * No-JS-safe: renders as a static strip if animation is off (reduced-motion zeros
 * `tmpl-edgerunner-marquee` via the blanket reset in theme.css — content stays visible).
 */
function TechMarquee({
  items,
}: {
  items: Array<{ name: string; iconSlug: string | null }>;
}) {
  // Double the array for seamless loop (translateX(-50%) lands exactly at the start).
  const row = [...items, ...items];

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderTop: '1px solid color-mix(in oklab, var(--neon-purple) 20%, transparent)',
        borderBottom: '1px solid color-mix(in oklab, var(--neon-purple) 20%, transparent)',
        background: 'color-mix(in oklab, var(--bg) 60%, transparent)',
        paddingBlock: '20px',
      }}
    >
      {/* Left fade mask */}
      <div
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          insetBlock: 0,
          left: 0,
          zIndex: 10,
          width: '96px',
          background: 'linear-gradient(to right, var(--bg), transparent)',
        }}
      />
      {/* Right fade mask */}
      <div
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          insetBlock: 0,
          right: 0,
          zIndex: 10,
          width: '96px',
          background: 'linear-gradient(to left, var(--bg), transparent)',
        }}
      />

      {/* The scrolling strip — CSS animation only, no JS state */}
      <div
        style={{
          display: 'flex',
          width: 'max-content',
          gap: '48px',
          paddingInline: '24px',
          animation: 'tmpl-edgerunner-marquee 40s linear infinite',
        }}
      >
        {row.map((item, i) => (
          <div
            key={`${item.name}-${i}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              whiteSpace: 'nowrap',
            }}
          >
            {item.iconSlug ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--neon-cyan)' }}>
                <BrandLogo slug={item.iconSlug} size={20} />
              </span>
            ) : null}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '16px',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: 'var(--muted-fg)',
              }}
            >
              {item.name}
            </span>
            <span style={{ color: 'var(--neon-pink)', fontFamily: 'var(--font-mono)' }}>/</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Skills section
// ─────────────────────────────────────────────────────────────────────────────

export function Skills({ section }: SectionProps) {
  const content = (section?.content ?? null) as SkillsContent | null;
  if (!content) return null;

  // hide-if-empty: only groups with ≥1 item with a present name survive.
  const groups = Array.isArray(content.groups)
    ? content.groups.filter((g) => Array.isArray(g?.items) && g.items.length > 0)
    : [];
  if (groups.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Skills';

  // Flatten all items for the TechMarquee strip.
  const allItems = groups.flatMap((g) =>
    g.items
      .filter((it) => present(it?.name))
      .map((it) => ({
        name: it.name,
        iconSlug: present(it.icon) ? it.icon! : null,
      }))
  );

  return (
    <div
      className="tmpl-shell"
      style={{
        ...sectionShellStyle,
        gap: '48px',
      }}
    >
      {/* ── Section header — centered eyebrow + big neon-glow title ─────── */}
      <SectionHeading eyebrow="// STACK" title={heading} accent="cyan" />

      {/* ── Groups grid (2-col on md+, faithful to the export layout) ─────── */}
      <div className="tmpl-skills-groups">
        {groups.map((group, gi) => {
          const items = group.items.filter((it) => present(it?.name));
          if (items.length === 0) return null;
          const groupLabel = present(group.label) ? group.label : null;

          // Rotate accent across groups: cyan → pink → purple → cyan…
          const accents: Array<string> = [
            'var(--neon-cyan)',
            'var(--neon-pink)',
            'var(--neon-purple)',
          ];
          const accentColor = accents[gi % accents.length];

          return (
            <div
              key={`${groupLabel ?? 'group'}-${gi}`}
              className="tmpl-holo-panel"
              style={{
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {/* Group header: category label + item count */}
              {groupLabel ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '16px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.16em',
                      color: accentColor,
                      margin: 0,
                    }}
                  >
                    {groupLabel}
                  </h3>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                      color: 'var(--muted-fg)',
                    }}
                  >
                    {items.length} modules
                  </span>
                </div>
              ) : null}

              {/* Items: gauges (with level) or pills (without level) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                  gap: '20px',
                  alignItems: 'start',
                }}
              >
                {items.map((item, ii) => {
                  const slug = present(item.icon) ? item.icon! : null;
                  const level = clampLevel(item.level);
                  const tier = item.tier as
                    | 'core'
                    | 'proficient'
                    | 'learning'
                    | undefined;

                  return level !== null ? (
                    // ── Circular gauge (the signature) ──────────────────────
                    <Gauge
                      key={`${item.name}-${ii}`}
                      name={item.name}
                      iconSlug={slug}
                      level={level}
                    />
                  ) : (
                    // ── Pill fallback (items without a level) ───────────────
                    <SkillPill
                      key={`${item.name}-${ii}`}
                      name={item.name}
                      iconSlug={slug}
                      tier={tier}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── TechMarquee — the infinite CSS strip below the groups ──────────── */}
      {allItems.length > 0 ? (
        <div style={{ marginInline: 'calc(-1 * clamp(1.5rem, 5vw, 4rem))' }}>
          <TechMarquee items={allItems} />
        </div>
      ) : null}
    </div>
  );
}
