/**
 * Projects section (blueprint section 5) — FAITHFUL clone of the export's `Projects.tsx`: a
 * 2-column card grid, each card an image on top (a small mono index badge overlaid) that scales
 * on hover, then a `/slug` mono tag, title, description, tech-stack pills (default) + category
 * tag pills (accent, capped 6), and a Live/Source link row under a hairline. The card lifts +
 * gains an accent border + blue glow on hover (`.bp-card`).
 *
 * DATA: `content.heading`, `content.items[{ slug, title, description, image?, image_alt?,
 * tech_stack[], tags?[], live_url?, repo_url? }]`. URLs go through `safeHref`; images through
 * `isHttpImageSrc`.
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { ProjectsContent } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';
import { safeHref } from '@/lib/safe-url';
import { MonoPill, SectionShell, present } from './shared';

export function Projects({ section }: SectionProps) {
  const content = (section?.content ?? null) as ProjectsContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items) ? content.items.filter((p) => present(p?.title)) : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'Selected Work';

  return (
    <SectionShell id="projects" channel="CH5" eyebrow="// SELECTED_WORK" heading={heading}>
      <div className="grid gap-8 md:grid-cols-2">
        {items.map((p, idx) => {
          const imageUrl = isHttpImageSrc(p.image) ? p.image : null;
          const imageAlt = present(p.image_alt) ? p.image_alt : '';
          const tech = Array.isArray(p.tech_stack) ? p.tech_stack.filter(present) : [];
          const tags = Array.isArray(p.tags) ? p.tags.filter(present).slice(0, 6) : [];
          const liveUrl = safeHref(p.live_url);
          const repoUrl = safeHref(p.repo_url);

          return (
            <article
              key={present(p.id) ? p.id : `${p.title}-${idx}`}
              className="bp-card group h-full flex flex-col border rounded-md overflow-hidden"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            >
              {imageUrl && imageAlt ? (
                <div
                  className="relative overflow-hidden aspect-[3/2]"
                  style={{ backgroundColor: 'var(--bg)' }}
                >
                  <Image
                    src={imageUrl}
                    alt={imageAlt}
                    fill
                    loading="lazy"
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="bp-card-img object-cover"
                  />
                  <div
                    className="bp-mono absolute top-3 left-3 text-[10px] tracking-wider uppercase px-2 py-1 border rounded-sm"
                    style={{
                      color: 'color-mix(in srgb, var(--fg) 80%, transparent)',
                      backgroundColor: 'color-mix(in srgb, var(--bg) 80%, transparent)',
                      borderColor: 'var(--border)',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                </div>
              ) : null}

              <div className="p-6 md:p-7 flex-1 flex flex-col">
                {present(p.slug) ? (
                  <div
                    className="bp-mono text-[10px] tracking-[0.18em] uppercase"
                    style={{ color: 'var(--muted-fg)' }}
                  >
                    /{p.slug}
                  </div>
                ) : null}
                <h3 className="bp-card-title mt-2 text-xl md:text-2xl font-semibold tracking-tight">
                  {p.title}
                </h3>
                {present(p.description) ? (
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted-fg)' }}>
                    {p.description}
                  </p>
                ) : null}

                {tech.length ? (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {tech.map((t) => (
                      <MonoPill key={t} variant="default">
                        {t}
                      </MonoPill>
                    ))}
                  </div>
                ) : null}

                {tags.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <MonoPill key={t} variant="accent">
                        {t}
                      </MonoPill>
                    ))}
                  </div>
                ) : null}

                {liveUrl || repoUrl ? (
                  <div
                    className="bp-mono mt-6 pt-5 border-t flex flex-wrap gap-4 text-[11px] tracking-wider uppercase"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {liveUrl ? (
                      <a
                        href={liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-4 hover:underline"
                        style={{ color: 'var(--accent)' }}
                      >
                        Live ↗
                      </a>
                    ) : null}
                    {repoUrl ? (
                      <a
                        href={repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bp-link-muted"
                        style={{ color: 'var(--muted-fg)' }}
                      >
                        Source ↗
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}
