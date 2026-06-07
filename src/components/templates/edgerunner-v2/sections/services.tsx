/**
 * Services section — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/components/sections/Services.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout classes VERBATIM from export JSX.
 *   2. Color classes → inline style with scoped var(--token):
 *      bg-neon-ACCENT/10 → color-mix(in oklab, var(--neon-ACCENT) 10%, transparent)
 *      text-neon-ACCENT → var(--neon-ACCENT)
 *      border-neon-ACCENT/OPACITY → color-mix(in oklab, var(--neon-ACCENT) OPACITY, transparent)
 *      bg-background/40 → color-mix(in srgb, var(--bg) 40%, transparent)
 *      text-foreground/75 → color-mix(in oklab, var(--fg) 75%, transparent)
 *      border-neon-pink shadow-neon-pink/40 → inline style
 *   3. Custom classes (font-mono-retro, font-display, text-neon-*, text-foreground,
 *      bg-neon-pink/10) KEPT where possible.
 *   4. DATA BINDING: services content items (title/description/icon/deliverables).
 *      "View all services" → scrolls to #contact (no /services route on single-scroll).
 *   5. Icon map: lucide icons by slug (same as edgerunner/sections/services.tsx).
 *   6. SERVER COMPONENT — no 'use client', no motion (bundle-budget; D-25 / TMPL-04).
 *      The export's per-card motion was `initial={false}` + `animate` = cards render AT REST
 *      (no visible entrance); the shared `ScrollReveal` kit wrapper already reveals the
 *      section on scroll. Converting the redundant `m.div` to a plain `<div>` drops
 *      `motion/react` from First Load JS with ZERO static-render change. The card hover-glow
 *      lives in `GlowCard` (its own client island), so interactivity is preserved.
 */
import Link from 'next/link';
import { type ComponentType } from 'react';
import {
  Code,
  Server,
  Palette,
  Sparkles,
  Globe,
  Database,
  Layers,
  Zap,
  ShieldCheck,
  LayoutDashboard,
  MonitorSmartphone,
  Cpu,
  ArrowRight,
} from 'lucide-react';

import type { SectionProps } from './types';
import type { ServicesContent } from '@/lib/validations';
import { present } from './shared';
import { SectionHeading } from './ui/section-heading';
import { GlowCard } from './ui/glow-card';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, ComponentType<any>> = {
  code: Code,
  server: Server,
  palette: Palette,
  sparkles: Sparkles,
  globe: Globe,
  database: Database,
  layers: Layers,
  zap: Zap,
  shield: ShieldCheck,
  dashboard: LayoutDashboard,
  monitor: MonitorSmartphone,
  cpu: Cpu,
};

type Accent = 'pink' | 'cyan' | 'purple';
const ACCENT_CYCLE: Accent[] = ['pink', 'cyan', 'purple'];

const accentBgStyle: Record<Accent, string> = {
  pink: 'color-mix(in oklab, var(--neon-pink) 10%, transparent)',
  cyan: 'color-mix(in oklab, var(--neon-cyan) 10%, transparent)',
  purple: 'color-mix(in oklab, var(--neon-purple) 10%, transparent)',
};

const accentTextClass: Record<Accent, string> = {
  pink: 'text-neon-pink',
  cyan: 'text-neon-cyan',
  purple: 'text-neon-purple',
};

const accentChipBorder: Record<Accent, string> = {
  pink: 'color-mix(in oklab, var(--neon-pink) 40%, transparent)',
  cyan: 'color-mix(in oklab, var(--neon-cyan) 40%, transparent)',
  purple: 'color-mix(in oklab, var(--neon-purple) 40%, transparent)',
};

const accentChipColor: Record<Accent, string> = {
  pink: 'color-mix(in oklab, var(--neon-pink) 90%, transparent)',
  cyan: 'color-mix(in oklab, var(--neon-cyan) 90%, transparent)',
  purple: 'color-mix(in oklab, var(--neon-purple) 90%, transparent)',
};

export function Services({ section, username }: SectionProps & { username?: string | null }) {
  const content = (section?.content ?? null) as ServicesContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.title))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Offerings';
  const subheading = present(content.subheading)
    ? content.subheading
    : 'Engagements I take on — usually 4 to 12 weeks, always end-to-end ownership.';

  // Show first 3 featured (matching the export's `services.slice(0, 3)`)
  const featured = items.slice(0, 3);

  return (
    <section id="services" className="relative py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Services"
          title={heading}
          description={subheading}
          accent="pink"
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((item, i) => {
            const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const IconComponent: ComponentType<any> =
              (item.icon && ICON_MAP[item.icon]) ? ICON_MAP[item.icon] : Code;
            const deliverables = Array.isArray(item.deliverables)
              ? item.deliverables.filter((d) => present(d))
              : [];

            return (
              <div
                key={present(item.id) ? item.id : `svc-${i}`}
              >
                <GlowCard accent={accent} className="h-full">
                  <div className="flex h-full flex-col">
                    {/* Icon box */}
                    <div
                      className={`grid h-12 w-12 place-items-center rounded-lg ${accentTextClass[accent]}`}
                      style={{ background: accentBgStyle[accent] }}
                    >
                      <IconComponent className="h-6 w-6" />
                    </div>

                    {/* Title */}
                    <h3
                      className="mt-4 font-display text-lg font-bold uppercase tracking-wider"
                      style={{ color: 'var(--fg)' }}
                    >
                      {item.title}
                    </h3>

                    {/* Description */}
                    {present(item.description) ? (
                      <p
                        className="mt-2 flex-1"
                        style={{ color: 'color-mix(in oklab, var(--fg) 75%, transparent)' }}
                      >
                        {item.description}
                      </p>
                    ) : null}

                    {/* Feature chips (deliverables, max 3 on the card) */}
                    {deliverables.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {deliverables.slice(0, 3).map((d, di) => (
                          <span
                            key={`${d}-${di}`}
                            className="rounded-full font-mono-retro text-xs uppercase tracking-wider px-2.5 py-0.5"
                            style={{
                              border: `1px solid ${accentChipBorder[accent]}`,
                              background: 'color-mix(in srgb, var(--bg) 40%, transparent)',
                              color: accentChipColor[accent],
                            }}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </GlowCard>
              </div>
            );
          })}
        </div>

        {/* "View all services" CTA — navigates to /${username}/services dedicated page */}
        <div className="mt-12 flex justify-center">
          <Link
            href={username ? `/${username}/services` : '/services'}
            className="group inline-flex items-center gap-3 rounded-md font-mono-retro text-sm uppercase tracking-widest text-neon-pink px-6 py-3 transition-all"
            style={{
              border: '1px solid var(--neon-pink)',
              background: 'color-mix(in oklab, var(--neon-pink) 10%, transparent)',
              boxShadow: '0 0 20px -8px color-mix(in oklab, var(--neon-pink) 40%, transparent)',
              textDecoration: 'none',
            }}
          >
            View all services
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
