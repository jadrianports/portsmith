/**
 * Certifications section (blueprint section 9) — FAITHFUL clone of the export's
 * `Certifications.tsx`: a 2-column hairline-gap grid of credential cells, each a title, a mono
 * `issuer · year` line, an optional description, and an optional accent "Verify ↗" link.
 *
 * DATA: `content.heading`, `content.items[{ title, issuer?, year?, description?, url? }]`.
 */
import type { SectionProps } from './types';
import type { CertificationsContent } from '@/lib/validations';
import { safeHref } from '@/lib/safe-url';
import { SectionShell, present } from './shared';

export function Certifications({ section }: SectionProps) {
  const content = (section?.content ?? null) as CertificationsContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items) ? content.items.filter((c) => present(c?.title)) : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Certifications';

  return (
    <SectionShell id="certifications" channel="CH10" eyebrow="// CERTIFICATIONS" heading={heading}>
      <ul
        className="grid gap-px md:grid-cols-2 border rounded-md overflow-hidden"
        style={{ backgroundColor: 'var(--border)', borderColor: 'var(--border)' }}
      >
        {items.map((c, idx) => {
          const verifyHref = safeHref(c.url);
          return (
            <li
              key={c.id ?? `${c.title}-${idx}`}
              className="p-6 md:p-7"
              style={{
                backgroundColor: 'var(--bg)',
                gridColumn: idx === items.length - 1 && items.length % 2 === 1 ? '1 / -1' : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{c.title}</h3>
                  {c.issuer || c.year ? (
                    <div className="bp-mono mt-1 text-[11px] tracking-wider uppercase" style={{ color: 'var(--muted-fg)' }}>
                      {present(c.issuer) ? c.issuer : ''}
                      {present(c.issuer) && present(c.year) ? ' · ' : ''}
                      {present(c.year) ? c.year : ''}
                    </div>
                  ) : null}
                  {present(c.description) ? (
                    <p className="mt-3 text-sm" style={{ color: 'color-mix(in srgb, var(--fg) 80%, transparent)' }}>
                      {c.description}
                    </p>
                  ) : null}
                </div>
                {verifyHref ? (
                  <a
                    href={verifyHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bp-mono shrink-0 text-[11px] tracking-wider uppercase underline-offset-4 hover:underline"
                    style={{ color: 'var(--accent-text)' }}
                  >
                    Verify ↗
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}
