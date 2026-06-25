/**
 * Services section (blueprint section 10) — FAITHFUL clone of the export's `Services.tsx`: a
 * 2-column grid of bordered cards (subtle accent-border + surface lift on hover via
 * `.bp-service`), each a zero-padded mono index, a title, a description, and a mono
 * deliverables list with accent `+` markers under a hairline.
 *
 * DATA: `content.heading`, `content.subheading?`, `content.items[{ title, description?,
 * deliverables? }]`.
 */
import type { SectionProps } from './types';
import type { ServicesContent } from '@/lib/validations';
import { SectionShell, present } from './shared';

export function Services({ section }: SectionProps) {
  const content = (section?.content ?? null) as ServicesContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items) ? content.items.filter((s) => present(s?.title)) : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Services';
  const subheading = present(content.subheading) ? content.subheading : undefined;

  return (
    <SectionShell id="services" channel="CH11" eyebrow="// SERVICES" heading={heading} subheading={subheading}>
      <div className="grid gap-6 md:grid-cols-2">
        {items.map((s, idx) => {
          const deliverables = Array.isArray(s.deliverables) ? s.deliverables.filter(present) : [];
          return (
            <div
              key={s.id ?? `${s.title}-${idx}`}
              className="bp-service h-full p-7 md:p-8 border rounded-md"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            >
              <div className="bp-mono text-[11px] tracking-[0.18em] uppercase" style={{ color: 'var(--muted-fg)' }}>
                {String(idx + 1).padStart(2, '0')}
              </div>
              <h3 className="mt-2 text-xl md:text-2xl font-semibold tracking-tight">{s.title}</h3>
              {present(s.description) ? (
                <p className="mt-3 leading-relaxed" style={{ color: 'var(--muted-fg)' }}>
                  {s.description}
                </p>
              ) : null}
              {deliverables.length ? (
                <ul
                  className="bp-mono mt-6 pt-5 border-t space-y-2 text-[12px] tracking-wide"
                  style={{ borderColor: 'var(--border)', color: 'color-mix(in srgb, var(--fg) 80%, transparent)' }}
                >
                  {deliverables.map((d) => (
                    <li key={d} className="flex gap-3">
                      <span style={{ color: 'var(--accent)' }}>+</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}
