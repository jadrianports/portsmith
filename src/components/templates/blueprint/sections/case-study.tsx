/**
 * Case Study section (blueprint section 6) — FAITHFUL clone of the export's `CaseStudy.tsx`: a
 * `// DEEP_DIVE` stack of bordered cards, each with a header (role/client/year pills + an
 * oversized title), a 1–3 column Challenge / Process / Outcome block row (Outcome's label in
 * the accent), then a hairline-gap image grid with mono `// FIG_NN` captions. Images carry
 * REQUIRED width/height (CLS-safe) + alt (the v2.8 `case_study` shape).
 *
 * DATA: `content.heading?`, `content.items[{ title, role?, client?, year?, challenge?, process?,
 * outcome?, images[{ url, width, height, alt }] }]`.
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { CaseStudyContent } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';
import { MonoPill, SectionShell, present } from './shared';

function Block({ label, body, accent }: { label: string; body: string; accent?: boolean }) {
  return (
    <div className="p-6 md:p-8" style={{ backgroundColor: 'var(--surface)' }}>
      <div
        className="bp-mono text-[11px] tracking-[0.18em] uppercase mb-3"
        style={{ color: accent ? 'var(--accent-text)' : 'var(--muted-fg)' }}
      >
        // {label}
      </div>
      <p
        className="leading-relaxed text-[15px]"
        style={{ color: 'color-mix(in srgb, var(--fg) 85%, transparent)' }}
      >
        {body}
      </p>
    </div>
  );
}

export function CaseStudy({ section }: SectionProps) {
  const content = (section?.content ?? null) as CaseStudyContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items) ? content.items.filter((cs) => present(cs?.title)) : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Deep Dive';

  return (
    <SectionShell id="case-study" channel="CH6" eyebrow="// DEEP_DIVE" heading={heading}>
      <div className="space-y-20">
        {items.map((cs) => {
          const blocks = [
            present(cs.challenge) ? { label: 'Challenge', body: cs.challenge as string, accent: false } : null,
            present(cs.process) ? { label: 'Process', body: cs.process as string, accent: false } : null,
            present(cs.outcome) ? { label: 'Outcome', body: cs.outcome as string, accent: true } : null,
          ].filter((b): b is { label: string; body: string; accent: boolean } => b !== null);

          const images = Array.isArray(cs.images)
            ? cs.images.filter((img) => isHttpImageSrc(img?.url) && present(img?.alt))
            : [];

          return (
            <article
              key={cs.id ?? cs.title}
              className="border rounded-md overflow-hidden"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            >
              <div className="p-6 md:p-10 border-b" style={{ borderColor: 'var(--border)' }}>
                {cs.role || cs.client || cs.year ? (
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {present(cs.role) ? <MonoPill variant="accent">{cs.role}</MonoPill> : null}
                    {present(cs.client) ? <MonoPill variant="default">{cs.client}</MonoPill> : null}
                    {present(cs.year) ? <MonoPill variant="muted">{cs.year}</MonoPill> : null}
                  </div>
                ) : null}
                <h3 className="text-2xl md:text-4xl font-semibold tracking-tight">{cs.title}</h3>
              </div>

              {blocks.length ? (
                <div
                  className="grid gap-px md:grid-cols-3"
                  style={{ backgroundColor: 'var(--border)' }}
                >
                  {blocks.map((b) => (
                    <Block key={b.label} label={b.label} body={b.body} accent={b.accent} />
                  ))}
                </div>
              ) : null}

              {images.length ? (
                <div
                  className="border-t grid sm:grid-cols-2 gap-px"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--border)' }}
                >
                  {images.map((img, i) => (
                    <figure key={img.id ?? i} className="m-0" style={{ backgroundColor: 'var(--bg)' }}>
                      <Image
                        src={img.url}
                        alt={img.alt}
                        width={img.width}
                        height={img.height}
                        loading="lazy"
                        unoptimized
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="w-full h-auto object-cover aspect-[3/2]"
                      />
                      <figcaption
                        className="bp-mono px-4 py-2 text-[10px] tracking-wider uppercase border-t"
                        style={{ color: 'var(--muted-fg)', borderColor: 'var(--border)' }}
                      >
                        // FIG_{String(i + 1).padStart(2, '0')}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}
