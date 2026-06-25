/**
 * Metrics section (blueprint section 4) — FAITHFUL clone of the export's `Metrics.tsx`: a
 * `// READOUT` strip of large mono `value`s with muted `label`s, the tiles separated by thin
 * vertical accent-tinted rules (the export's `bg-accent/40` rules, here realized as the
 * hairline-gap ground so it is robust across the 2-col → 4-col breakpoints). A small mono index
 * tag sits above each big number (the export rendered the raw item id there — replaced by a
 * clean zero-padded index, since Portsmith ids are internal nanoids).
 *
 * DATA: `content.heading`, `content.subheading?`, `content.items[{ value, label }]`.
 */
import type { SectionProps } from './types';
import type { MetricsContent } from '@/lib/validations';
import { SectionShell, present } from './shared';

export function Metrics({ section }: SectionProps) {
  const content = (section?.content ?? null) as MetricsContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((m) => present(m?.value) && present(m?.label))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'By the numbers';
  const subheading = present(content.subheading) ? content.subheading : undefined;

  return (
    <SectionShell id="metrics" channel="CH4" eyebrow="// READOUT" heading={heading} subheading={subheading}>
      <dl
        className="grid grid-cols-2 lg:grid-cols-4 gap-px border rounded-md overflow-hidden"
        style={{
          // The gap shows this tinted ground as thin blue-tinted rules between tiles.
          backgroundColor: 'color-mix(in srgb, var(--accent) 22%, var(--border))',
          borderColor: 'var(--border)',
        }}
      >
        {items.map((m, i) => (
          <div
            key={m.id ?? i}
            className="relative p-6 md:p-8"
            style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 45%, var(--bg))' }}
          >
            <dt
              className="bp-mono text-[10px] tracking-[0.18em] uppercase"
              style={{ color: 'var(--muted-fg)' }}
            >
              {String(i + 1).padStart(2, '0')}
            </dt>
            <dd
              className="bp-mono mt-3 text-4xl md:text-5xl tracking-tight"
              style={{ color: 'var(--accent)' }}
            >
              {m.value}
            </dd>
            <p
              className="mt-2 text-sm leading-snug"
              style={{ color: 'color-mix(in srgb, var(--fg) 80%, transparent)' }}
            >
              {m.label}
            </p>
          </div>
        ))}
      </dl>
    </SectionShell>
  );
}
