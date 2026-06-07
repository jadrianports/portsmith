/**
 * Experience section — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/components/sections/Experience.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout classes VERBATIM from export JSX.
 *   2. Color classes → inline style with scoped var(--token):
 *      bg-neon-pink / shadow-neon-pink → var(--neon-pink), var(--shadow-neon-pink)
 *      text-neon-cyan → var(--neon-cyan)
 *      text-foreground → var(--fg)
 *      text-foreground/80 → color-mix(in oklab, var(--fg) 80%, transparent)
 *      text-foreground/75 → color-mix(in oklab, var(--fg) 75%, transparent)
 *      bg-gradient-to-b from-neon-pink via-neon-purple to-neon-cyan → linear-gradient(...)
 *      bg-neon-cyan shadow-neon-cyan → var(--neon-cyan)
 *   3. Custom classes (font-mono-retro, font-display, text-neon-*, text-glow-pink) KEPT.
 *   4. DATA BINDING: experience content items. No location field (not in schema).
 *   5. GlowCard imported from local ui/ folder.
 *   6. SERVER COMPONENT — no 'use client', no motion (bundle-budget; D-25 / TMPL-04).
 *      The export's per-item motion was `initial={false}` + `animate` = rows render AT REST
 *      (no visible entrance); the shared `ScrollReveal` kit wrapper already reveals the
 *      section on scroll. Converting the redundant `m.li` to a plain `<li>` drops
 *      `motion/react` from First Load JS with ZERO static-render change.
 */
import type { SectionProps } from './types';
import type { ExperienceContent, ExperienceItem } from '@/lib/validations';
import { present } from './shared';
import { SectionHeading } from './ui/section-heading';
import { GlowCard } from './ui/glow-card';

// ---------------------------------------------------------------------------
// Date helpers — verbatim from edgerunner/sections/experience.tsx
// ---------------------------------------------------------------------------

function formatDatePart(value: string | null | undefined): string | null {
  if (!present(value)) return null;
  const v = value.trim();
  if (v.toLowerCase() === 'present') return 'Present';
  const match = /^(\d{4})-\d{2}$/.exec(v);
  return match ? match[1] : v;
}

function formatRange(start: string | null | undefined, end: string | null | undefined): string | null {
  const startPart = formatDatePart(start);
  if (!startPart) return null;
  const endPart = formatDatePart(end);
  return endPart ? `${startPart} — ${endPart}` : startPart;
}

// ---------------------------------------------------------------------------
// Per-item card
// ---------------------------------------------------------------------------

function ExperienceCard({ item, left }: { item: ExperienceItem; left: boolean }) {
  const company = present(item.company) ? item.company : null;
  const role = present(item.role) ? item.role : null;
  const dateRange = formatRange(item.start_date, item.end_date);
  const description = present(item.description) ? item.description : null;
  const highlights = Array.isArray(item.highlights)
    ? item.highlights.filter((h) => present(h))
    : [];

  return (
    <GlowCard accent={left ? 'pink' : 'cyan'} className="ml-12 md:ml-0">
      {dateRange ? (
        <div className="font-mono-retro text-base uppercase tracking-widest text-neon-cyan">
          {dateRange}
        </div>
      ) : null}
      {role ? (
        <h3
          className="mt-1 font-display text-xl font-bold uppercase tracking-wide"
          style={{ color: 'var(--fg)' }}
        >
          {role}
        </h3>
      ) : null}
      {company ? (
        <div className="mt-1 text-neon-pink text-glow-pink">{company}</div>
      ) : null}
      {description ? (
        <p
          className="mt-3"
          style={{ color: 'color-mix(in oklab, var(--fg) 80%, transparent)' }}
        >
          {description}
        </p>
      ) : null}
      {highlights.length > 0 ? (
        <ul className={left ? 'mt-4 space-y-1.5 md:list-none' : 'mt-4 space-y-1.5'}>
          {highlights.map((h, hi) => (
            <li
              key={hi}
              className="flex items-start gap-2"
              style={{ color: 'color-mix(in oklab, var(--fg) 75%, transparent)' }}
            >
              <span
                className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{
                  background: 'var(--neon-cyan)',
                  boxShadow: 'var(--shadow-neon-cyan)',
                }}
              />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </GlowCard>
  );
}

// ---------------------------------------------------------------------------
// Section root
// ---------------------------------------------------------------------------

export function Experience({ section }: SectionProps) {
  const content = (section?.content ?? null) as ExperienceContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.company) || present(it?.role))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Timeline.exe';

  return (
    <section id="experience" className="relative py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Experience"
          title={heading}
          description="Eight years of shipping high-end software across studios, startups, and enterprise."
          accent="pink"
        />

        <div className="relative">
          {/* Neon gradient spine */}
          <div
            className="absolute left-4 top-0 bottom-0 w-px md:left-1/2"
            style={{
              background: 'linear-gradient(to bottom, var(--neon-pink), var(--neon-purple), var(--neon-cyan))',
            }}
          />

          <ul className="space-y-12">
            {items.map((item, i) => {
              const left = i % 2 === 0;
              return (
                <li
                  key={present(item.id) ? item.id : `${item.company}-${item.role}-${i}`}
                  className="relative md:grid md:grid-cols-2 md:gap-12"
                >
                  {/* Node marker */}
                  <span
                    className="absolute left-4 top-6 h-4 w-4 -translate-x-1/2 rounded-full md:left-1/2"
                    style={{
                      background: 'var(--neon-pink)',
                      boxShadow: 'var(--shadow-neon-pink)',
                    }}
                  />

                  <div className={left ? 'md:pr-12 md:text-right' : 'md:col-start-2 md:pl-12'}>
                    <ExperienceCard item={item} left={left} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
