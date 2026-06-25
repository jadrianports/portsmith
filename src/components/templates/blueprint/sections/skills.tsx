/**
 * Skills section (blueprint section 3) — FAITHFUL clone of the export's `Skills.tsx`: a 2-column
 * grid of competency groups separated by hairline gaps (`gap-px` over a border ground, each
 * cell on the page canvas), each group a zero-padded mono header + a wrap of tier pills
 * (core = filled accent, proficient = outline accent, learning = muted), then a mono legend.
 * No bars (the standard-lane tasteful-label rendering — Phase-3 D-09).
 *
 * DATA: `content.heading`, `content.groups[{ label, items[{ name, tier? }] }]`.
 */
import type { SectionProps } from './types';
import type { SkillsContent } from '@/lib/validations';
import { MonoPill, SectionShell, present, type PillVariant } from './shared';

const tierVariant: Record<string, PillVariant> = {
  core: 'core',
  proficient: 'proficient',
  learning: 'learning',
};

export function Skills({ section }: SectionProps) {
  const content = (section?.content ?? null) as SkillsContent | null;
  if (!content) return null;

  const groups = Array.isArray(content.groups)
    ? content.groups.filter((g) => present(g?.label) && Array.isArray(g?.items) && g.items.length > 0)
    : [];
  if (groups.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Skills';

  return (
    <SectionShell id="skills" channel="CH3" eyebrow="// SKILLS_TOOLING" heading={heading}>
      <div
        className="grid gap-px md:grid-cols-2 border rounded-md overflow-hidden"
        style={{ backgroundColor: 'var(--border)', borderColor: 'var(--border)' }}
      >
        {groups.map((group, idx) => (
          <div
            key={group.label}
            className="p-6 md:p-8"
            style={{
              backgroundColor: 'var(--bg)',
              // Odd count: the last cell spans both columns so no grey empty cell shows.
              gridColumn: idx === groups.length - 1 && groups.length % 2 === 1 ? '1 / -1' : undefined,
            }}
          >
            <div
              className="bp-mono text-[11px] tracking-[0.18em] uppercase mb-5"
              style={{ color: 'var(--muted-fg)' }}
            >
              {String(idx + 1).padStart(2, '0')} · {group.label}
            </div>
            <ul className="flex flex-wrap gap-2">
              {group.items
                .filter((it) => present(it?.name))
                .map((item) => (
                  <li key={item.name}>
                    <MonoPill variant={item.tier ? tierVariant[item.tier] ?? 'default' : 'default'}>
                      {item.name}
                      {item.tier ? (
                        <span className="ml-2 normal-case tracking-normal" style={{ opacity: 0.6 }}>
                          · {item.tier}
                        </span>
                      ) : null}
                    </MonoPill>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <div
        className="bp-mono mt-6 flex flex-wrap gap-4 text-[10px] tracking-wider uppercase"
        style={{ color: 'var(--muted-fg)' }}
      >
        <span>
          <span
            className="inline-block w-2 h-2 rounded-sm align-middle mr-2"
            style={{ backgroundColor: 'var(--accent)' }}
          />
          core
        </span>
        <span>
          <span
            className="inline-block w-2 h-2 rounded-sm align-middle mr-2 border"
            style={{ borderColor: 'var(--accent)' }}
          />
          proficient
        </span>
        <span>
          <span
            className="inline-block w-2 h-2 rounded-sm align-middle mr-2 border"
            style={{ borderColor: 'var(--border)' }}
          />
          learning
        </span>
      </div>
    </SectionShell>
  );
}
