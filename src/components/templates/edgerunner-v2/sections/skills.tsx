/**
 * Skills section — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/components/sections/Tools.tsx + TechMarquee.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout classes VERBATIM from export JSX.
 *   2. Color classes → inline style with scoped var(--token):
 *      text-neon-* → var(--neon-*)
 *      text-foreground/60 → color-mix(in oklab, var(--fg) 60%, transparent)
 *      text-foreground/90 → color-mix(in oklab, var(--fg) 90%, transparent)
 *      text-foreground/70 → color-mix(in oklab, var(--fg) 70%, transparent)
 *      border-neon-purple/20 → color-mix(in oklab, var(--neon-purple) 20%, transparent)
 *      bg-background/40 → color-mix(in srgb, var(--bg) 40%, transparent)
 *      stroke="color-mix(in oklab, var(--foreground) 12%...)" → var(--border)
 *   3. Custom classes (font-mono-retro, font-display, text-neon-*) KEPT AS-IS.
 *   4. Gauge: framer-motion useInView → CSS-only SSR fill (strokeDashoffset={offset}),
 *      CSS animation via tmpl-edgerunner-v2-marquee for TechMarquee.
 *      SSR-filled: no JS required for final gauge state.
 *   5. DATA BINDING: skills content groups[].items[].
 *   6. Brand icons via simple-icons (TECH_ICONS map from icons.ts).
 *   7. SERVER COMPONENT — no 'use client', no hooks.
 */
import type { SectionProps } from './types';
import type { SkillsContent } from '@/lib/validations';
import { TECH_ICONS } from './icons';
import { present } from './shared';
import { SectionHeading } from './ui/section-heading';
import { GlowCard } from './ui/glow-card';

// Gauge constants — faithful to export's 72×72 viewBox (we use 72×72 too)
const R = 28;
const C = 2 * Math.PI * R; // ≈ 175.93

const accentStroke: Record<'pink' | 'cyan' | 'purple', string> = {
  pink: 'var(--neon-pink)',
  cyan: 'var(--neon-cyan)',
  purple: 'var(--neon-purple)',
};

const accentTextClass: Record<'pink' | 'cyan' | 'purple', string> = {
  pink: 'text-neon-pink',
  cyan: 'text-neon-cyan',
  purple: 'text-neon-purple',
};

function clampLevel(level: number | null | undefined): number | null {
  if (typeof level !== 'number' || !Number.isFinite(level)) return null;
  return Math.max(0, Math.min(100, Math.round(level)));
}

/** Brand logo from simple-icons — server-rendered, zero client JS. */
function BrandLogo({ slug, size = 28 }: { slug: string; size?: number }) {
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
 * Circular SVG gauge — faithful to the export.
 * SSR contract: strokeDashoffset={offset} (FILLED value) — gauge is never empty on SSR.
 * CSS fill animation via tmpl-edgerunner-v2-marquee (progressive enhancement).
 */
function Gauge({
  name,
  iconSlug,
  level,
  accent,
}: {
  name: string;
  iconSlug: string | null;
  level: number;
  accent: 'pink' | 'cyan' | 'purple';
}) {
  const offset = C * (1 - level / 100);
  const stroke = accentStroke[accent];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
          {/* Track */}
          <circle
            cx="36"
            cy="36"
            r={R}
            fill="none"
            stroke="var(--border)"
            strokeWidth="5"
          />
          {/* Progress arc — SSR-filled */}
          <circle
            cx="36"
            cy="36"
            r={R}
            fill="none"
            stroke={stroke}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 6px ${stroke})` }}
          />
        </svg>
        {/* Center icon */}
        <div className="absolute inset-0 grid place-items-center">
          {iconSlug ? (
            <span style={{ color: 'color-mix(in oklab, var(--fg) 90%, transparent)' }}>
              <BrandLogo slug={iconSlug} size={28} />
            </span>
          ) : null}
        </div>
      </div>
      <div className="text-center">
        <div
          className="font-mono-retro text-base"
          style={{ color: 'color-mix(in oklab, var(--fg) 90%, transparent)' }}
        >
          {name}
        </div>
        <div className={`font-display text-sm font-bold ${accentTextClass[accent]}`}>
          {level}%
        </div>
      </div>
    </div>
  );
}

/**
 * TechMarquee — infinite horizontal strip (port of TechMarquee.tsx).
 * CSS-only animation via tmpl-edgerunner-v2-marquee keyframe (theme.css).
 * aria-hidden — decorative; all names appear in gauge grid above.
 */
function TechMarquee({ items }: { items: Array<{ name: string; iconSlug: string | null }> }) {
  const row = [...items, ...items];
  return (
    <div
      className="relative overflow-hidden py-6"
      style={{
        borderTop: '1px solid color-mix(in oklab, var(--neon-purple) 20%, transparent)',
        borderBottom: '1px solid color-mix(in oklab, var(--neon-purple) 20%, transparent)',
        background: 'color-mix(in srgb, var(--bg) 40%, transparent)',
      }}
      aria-hidden="true"
    >
      {/* Left fade */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24"
        style={{ background: 'linear-gradient(to right, var(--bg), transparent)' }}
      />
      {/* Right fade */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24"
        style={{ background: 'linear-gradient(to left, var(--bg), transparent)' }}
      />
      {/* Scrolling strip */}
      <div
        className="flex w-max gap-12 px-6"
        style={{ animation: 'tmpl-edgerunner-v2-marquee 40s linear infinite' }}
      >
        {row.map((item, i) => (
          <div
            key={`${item.name}-${i}`}
            className="flex items-center gap-3 whitespace-nowrap"
          >
            {item.iconSlug ? (
              <span style={{ color: 'var(--neon-cyan)', display: 'inline-flex', alignItems: 'center' }}>
                <BrandLogo slug={item.iconSlug} size={24} />
              </span>
            ) : null}
            <span
              className="font-mono-retro text-lg uppercase tracking-widest"
              style={{ color: 'color-mix(in oklab, var(--fg) 70%, transparent)' }}
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

// ---------------------------------------------------------------------------
// Skills section root
// ---------------------------------------------------------------------------

export function Skills({ section }: SectionProps) {
  const content = (section?.content ?? null) as SkillsContent | null;
  if (!content) return null;

  const groups = Array.isArray(content.groups)
    ? content.groups.filter((g) => Array.isArray(g?.items) && g.items.length > 0)
    : [];
  if (groups.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Loadout';

  const accents: Array<'pink' | 'cyan' | 'purple'> = ['pink', 'cyan', 'purple'];

  // Flatten all items for TechMarquee
  const allItems = groups.flatMap((g) =>
    g.items
      .filter((it) => present(it?.name))
      .map((it) => ({
        name: it.name,
        iconSlug: present(it.icon) ? it.icon! : null,
      }))
  );

  return (
    <section id="stack" className="relative py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Tech Stack"
          title={heading}
          accent="cyan"
        />

        <div className="grid gap-6 md:grid-cols-2">
          {groups.map((group, gi) => {
            const accent = accents[gi % accents.length];
            const items = group.items.filter((it) => present(it?.name));
            const groupLabel = present(group.label) ? group.label : null;

            return (
              <GlowCard
                key={`${groupLabel ?? 'group'}-${gi}`}
                accent={accent}
              >
                <div className="mb-5 flex items-center justify-between">
                  {groupLabel ? (
                    <h3 className={`font-display text-lg font-bold uppercase tracking-widest ${accentTextClass[accent]}`}>
                      {groupLabel}
                    </h3>
                  ) : null}
                  <span
                    className="font-mono-retro text-base"
                    style={{ color: 'color-mix(in oklab, var(--fg) 60%, transparent)' }}
                  >
                    {items.length} modules
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-5 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4">
                  {items.map((item, ii) => {
                    const slug = present(item.icon) ? item.icon! : null;
                    const level = clampLevel(item.level);
                    return level !== null ? (
                      <Gauge
                        key={`${item.name}-${ii}`}
                        name={item.name}
                        iconSlug={slug}
                        level={level}
                        accent={accent}
                      />
                    ) : (
                      /* Pill fallback (no level) */
                      <div
                        key={`${item.name}-${ii}`}
                        className="flex flex-col items-center gap-2"
                      >
                        <div
                          className="h-20 w-20 rounded-xl flex items-center justify-center"
                          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                        >
                          {slug ? (
                            <span style={{ color: 'var(--neon-cyan)' }}>
                              <BrandLogo slug={slug} size={28} />
                            </span>
                          ) : null}
                        </div>
                        <div
                          className="font-mono-retro text-base text-center"
                          style={{ color: 'color-mix(in oklab, var(--fg) 90%, transparent)' }}
                        >
                          {item.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlowCard>
            );
          })}
        </div>

        {/* TechMarquee strip below groups */}
        {allItems.length > 0 ? (
          <div className="mt-10">
            <TechMarquee items={allItems} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
