/**
 * Testimonials section (blueprint section 11) — FAITHFUL clone of the export's
 * `Testimonials.tsx`: a 2-column grid of quote cards with a 2px accent left-rule, optional
 * accent stars, a quote wrapped in accent mono quote-marks, and a footer with an avatar (or a
 * mono initials fallback) + name + company.
 *
 * DATA: `content.heading`, `content.items[{ name, quote, avatar?, avatar_alt?, stars?, company? }]`.
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { TestimonialsContent } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';
import { SectionShell, Stars, present } from './shared';

export function Testimonials({ section }: SectionProps) {
  const content = (section?.content ?? null) as TestimonialsContent | null;
  if (!content) return null;

  const items = Array.isArray(content.items)
    ? content.items.filter((t) => present(t?.name) && present(t?.quote))
    : [];
  if (items.length === 0) return null;

  const heading = present(content.heading) ? content.heading : 'What people say';

  return (
    <SectionShell id="testimonials" channel="CH12" eyebrow="// VOICES" heading={heading}>
      <div className="grid gap-6 md:grid-cols-2">
        {items.map((t, idx) => {
          const avatarUrl = isHttpImageSrc(t.avatar) ? t.avatar : null;
          const avatarAlt = present(t.avatar_alt) ? t.avatar_alt : `${t.name}, portrait`;
          const initials = t.name
            .split(' ')
            .map((p) => p[0])
            .slice(0, 2)
            .join('');
          return (
            <article
              key={t.id ?? `${t.name}-${idx}`}
              className="h-full p-7 md:p-8 border rounded-md"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--surface)',
                borderLeft: '2px solid var(--accent)',
              }}
            >
              {typeof t.stars === 'number' ? (
                <div className="mb-4">
                  <Stars count={t.stars} />
                </div>
              ) : null}
              <blockquote className="text-lg leading-relaxed" style={{ color: 'color-mix(in srgb, var(--fg) 90%, transparent)' }}>
                <span className="bp-mono mr-1" style={{ color: 'var(--accent-text)' }}>
                  &quot;
                </span>
                {t.quote}
                <span className="bp-mono ml-1" style={{ color: 'var(--accent-text)' }}>
                  &quot;
                </span>
              </blockquote>
              <footer
                className="mt-6 pt-5 border-t flex items-center gap-4"
                style={{ borderColor: 'var(--border)' }}
              >
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={avatarAlt}
                    width={48}
                    height={48}
                    loading="lazy"
                    unoptimized
                    className="h-12 w-12 rounded-full object-cover border"
                    style={{ borderColor: 'var(--border)' }}
                  />
                ) : (
                  <div
                    aria-hidden
                    className="bp-mono h-12 w-12 rounded-full border flex items-center justify-center text-sm"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-muted)', color: 'var(--muted-fg)' }}
                  >
                    {initials}
                  </div>
                )}
                <div>
                  <div className="font-semibold" style={{ color: 'var(--fg)' }}>
                    {t.name}
                  </div>
                  {present(t.company) ? (
                    <div className="bp-mono text-[11px] tracking-wider uppercase" style={{ color: 'var(--muted-fg)' }}>
                      {t.company}
                    </div>
                  ) : null}
                </div>
              </footer>
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}
