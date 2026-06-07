/**
 * Services section (edgerunner) — the "OFFERINGS" block (faithful-clone task).
 *
 * Reference: the export's Services page, adapted as a single-scroll section.
 * STRUCTURE:
 *   - Centered SectionHeading eyebrow "// SERVICES" + heading (content.heading) +
 *     optional subheading (content.subheading).
 *   - 3-col responsive grid of service cards (same .tmpl-projects-grid CSS class so
 *     the responsive 1→2→3 col breakpoints are reused — no inline gridTemplateColumns).
 *   - Each card: a lucide icon in a rounded neon box, title (display font), description
 *     (muted body), and deliverables[] as small cyan-accent chips.
 *   - Card accent cycles pink/cyan/purple by index (same pattern as projects).
 *
 * SERVER COMPONENT (NO 'use client'): no hooks, no event handlers.
 *
 * HIDE-IF-EMPTY: returns null when content is absent or items array is empty.
 *
 * ICON MAP: maps the item's `icon` slug to a lucide-react icon component. Unknown slugs
 * fall back to the `Code` default so a card is never empty-icon.
 *
 * COLOR: tokens only — no hardcoded hex; all via var(--token) from theme.css (SHARED-D).
 */

import type { ComponentType, CSSProperties } from 'react';
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
} from 'lucide-react';

import type { SectionProps } from './types';
import type { ServicesContent } from '@/lib/validations';
import { present, sectionShellStyle } from './shared';
import { SectionHeading } from './ui/section-heading';
import { ScrollReveal } from '../../_kit';

// ---------------------------------------------------------------------------
// Icon map — icon slug → lucide component
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Card accent cycling
// ---------------------------------------------------------------------------

type Accent = 'pink' | 'cyan' | 'purple';
const ACCENT_CYCLE: Accent[] = ['pink', 'cyan', 'purple'];

const accentNeonVar: Record<Accent, string> = {
  pink: 'var(--neon-pink)',
  cyan: 'var(--neon-cyan)',
  purple: 'var(--neon-purple)',
};

// ---------------------------------------------------------------------------
// Services section root
// ---------------------------------------------------------------------------

export function Services({ section }: SectionProps) {
  const content = (section?.content ?? null) as ServicesContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.title))
    : [];

  // hide-if-empty
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Offerings';
  const subheading = present(content.subheading) ? content.subheading : undefined;

  return (
    <div className="tmpl-shell" style={sectionShellStyle}>
      {/* Centered section header */}
      <SectionHeading
        eyebrow="// SERVICES"
        title={heading}
        description={subheading}
        accent="cyan"
      />

      {/* 3-col responsive grid — same CSS class as projects (1→2→3 col).
          NOT setting gridTemplateColumns inline — the .tmpl-projects-grid class drives
          the responsive breakpoints; inline styles override class specificity. */}
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gap: '24px',
        }}
        className="tmpl-projects-grid"
      >
        {items.map((item, i) => {
          const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
          const neonColor = accentNeonVar[accent];

          // Resolve icon component — fallback to Code for unknown slugs.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const IconComponent: ComponentType<any> = (item.icon && ICON_MAP[item.icon]) ? ICON_MAP[item.icon] : Code;

          const deliverables = Array.isArray(item.deliverables)
            ? item.deliverables.filter((d) => present(d))
            : [];

          // Card style — elevated surface with accent-colored top border.
          const cardStyle: CSSProperties = {
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderTop: `2px solid ${neonColor}`,
            borderRadius: 'var(--radius-lg)',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            height: '100%',
            boxShadow: `0 0 24px -12px color-mix(in oklab, ${neonColor} 30%, transparent)`,
          };

          // Icon box — small rounded neon-bordered box.
          const iconBoxStyle: CSSProperties = {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            border: `1px solid color-mix(in oklab, ${neonColor} 50%, transparent)`,
            background: `color-mix(in oklab, ${neonColor} 10%, var(--surface-muted))`,
            color: neonColor,
            flexShrink: 0,
          };

          return (
            <ScrollReveal key={present(item.id) ? item.id : `svc-${i}`} as="li" delay={i * 80}>
              <div style={cardStyle}>
                {/* Icon box */}
                <div style={iconBoxStyle}>
                  <IconComponent size={22} aria-hidden="true" strokeWidth={1.75} />
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: '1.05rem',
                    lineHeight: 1.25,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--fg)',
                    margin: 0,
                  }}
                >
                  {item.title}
                </h3>

                {/* Description */}
                {present(item.description) ? (
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 400,
                      fontSize: '14px',
                      lineHeight: 1.6,
                      color: 'var(--muted-fg)',
                      margin: 0,
                      flexGrow: 1,
                    }}
                  >
                    {item.description}
                  </p>
                ) : null}

                {/* Deliverables chips */}
                {deliverables.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      marginTop: 'auto',
                      paddingTop: '8px',
                    }}
                  >
                    {deliverables.map((d, di) => (
                      <span
                        key={`${d}-${di}`}
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.12em',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: `color-mix(in oklab, ${neonColor} 8%, var(--surface-muted))`,
                          color: neonColor,
                          border: `1px solid color-mix(in oklab, ${neonColor} 30%, transparent)`,
                        }}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </ScrollReveal>
          );
        })}
      </ul>
    </div>
  );
}
