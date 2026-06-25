/**
 * Education section (blueprint section 8) — FAITHFUL clone of the export's `Education.tsx`: the
 * same blueprint-blue timeline spine + accent node dots as Experience, each entry a mono `year`
 * label, a degree heading, the school, and optional accent-marked achievement bullets.
 *
 * DATA: `content.heading`, `content.items[{ degree, school, year?, achievements? }]`.
 */
import type { SectionProps } from './types';
import type { EducationContent } from '@/lib/validations';
import { SectionShell, present } from './shared';

export function Education({ section }: SectionProps) {
  const content = (section?.content ?? null) as EducationContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((it) => present(it?.degree) && present(it?.school))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Education';

  return (
    <SectionShell id="education" channel="CH9" eyebrow="// EDUCATION" heading={heading}>
      <ol className="relative ml-3 space-y-10 border-l" style={{ borderColor: 'var(--border)' }}>
        {items.map((item) => {
          const achievements = Array.isArray(item.achievements) ? item.achievements.filter(present) : [];
          return (
            <li key={item.id ?? `${item.degree}-${item.school}`} className="relative pl-8">
              <span
                aria-hidden
                className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full"
                style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 0 4px var(--bg)' }}
              />
              {present(item.year) ? (
                <div className="bp-mono text-[11px] tracking-wider uppercase" style={{ color: 'var(--muted-fg)' }}>
                  {item.year}
                </div>
              ) : null}
              <h3 className="mt-2 text-xl font-semibold tracking-tight">{item.degree}</h3>
              <p style={{ color: 'var(--muted-fg)' }}>{item.school}</p>
              {achievements.length ? (
                <ul className="mt-3 space-y-1.5 text-sm" style={{ color: 'color-mix(in srgb, var(--fg) 80%, transparent)' }}>
                  {achievements.map((a) => (
                    <li key={a} className="flex gap-3">
                      <span className="bp-mono mt-1" style={{ color: 'var(--accent)' }}>
                        ›
                      </span>
                      <span>{a}</span>
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
