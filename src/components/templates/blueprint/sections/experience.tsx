/**
 * Experience section (blueprint section 7) — FAITHFUL clone of the export's `Experience.tsx`: a
 * vertical timeline (a thin blueprint-blue spine + accent node dots ringed in the page canvas),
 * each entry a mono date range (end "Present" in the accent), a `role · company` heading, a
 * description, and optional accent-marked highlight bullets.
 *
 * DATA: `content.heading`, `content.items[{ company, role, start_date, end_date, description,
 * highlights? }]`. Dates are YYYY-MM / "present" → `formatMonth`.
 */
import type { SectionProps } from './types';
import type { ExperienceContent } from '@/lib/validations';
import { SectionShell, formatMonth, present } from './shared';

export function Experience({ section }: SectionProps) {
  const content = (section?.content ?? null) as ExperienceContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.role) && present(it?.company))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Experience';

  return (
    <SectionShell id="experience" channel="CH8" eyebrow="// EXPERIENCE" heading={heading}>
      <ol className="relative ml-3 space-y-12 border-l" style={{ borderColor: 'var(--border)' }}>
        {items.map((item) => {
          const isPresent = (item.end_date ?? '').toLowerCase() === 'present';
          const highlights = Array.isArray(item.highlights) ? item.highlights.filter(present) : [];
          return (
            <li key={item.id ?? `${item.role}-${item.company}`} className="relative pl-8">
              <span
                aria-hidden
                className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full"
                style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 0 4px var(--bg)' }}
              />
              <div className="bp-mono text-[11px] tracking-wider uppercase" style={{ color: 'var(--muted-fg)' }}>
                {formatMonth(item.start_date)} —{' '}
                <span style={isPresent ? { color: 'var(--accent-text)' } : undefined}>
                  {present(item.end_date) ? formatMonth(item.end_date) : 'Present'}
                </span>
              </div>
              <h3 className="mt-2 text-xl md:text-2xl font-semibold tracking-tight">
                {item.role} <span style={{ color: 'var(--muted-fg)', fontWeight: 400 }}>· {item.company}</span>
              </h3>
              {present(item.description) ? (
                <p className="mt-3 leading-relaxed" style={{ color: 'color-mix(in srgb, var(--fg) 85%, transparent)' }}>
                  {item.description}
                </p>
              ) : null}
              {highlights.length ? (
                <ul className="mt-4 space-y-1.5 text-sm" style={{ color: 'color-mix(in srgb, var(--fg) 80%, transparent)' }}>
                  {highlights.map((h) => (
                    <li key={h} className="flex gap-3">
                      <span className="bp-mono mt-1" style={{ color: 'var(--accent-text)' }}>
                        ›
                      </span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </SectionShell>
  );
}
