/**
 * About section (blueprint section 2) — FAITHFUL clone of the export's `About.tsx`: a two-column
 * `[1fr_320px]` split — a large light-weight bio + mono skill pills on the left, a bordered
 * square portrait with a ring + a mono filename caption on the right. The export's per-column
 * framer-motion `Reveal`s collapse into the section-level kit `ScrollReveal` (pixel-identical at
 * rest), so this is a pure Server Component.
 *
 * DATA: `content.bio` (required), `content.skills[]`, `content.avatar` + `content.avatar_alt`.
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { AboutContent } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';
import { MonoPill, SectionShell, present } from './shared';

export function About({ section }: SectionProps) {
  const content = (section?.content ?? null) as AboutContent | null;
  if (!content) return null;

  const bio = present(content.bio) ? content.bio : null;
  if (!bio) return null;

  const skills = Array.isArray(content.skills) ? content.skills.filter(present) : [];
  const avatarUrl = isHttpImageSrc(content.avatar) ? content.avatar : null;
  const avatarAlt = present(content.avatar_alt) ? content.avatar_alt : '';

  return (
    <SectionShell id="about" channel="CH2" eyebrow="// ABOUT">
      <div className="grid gap-12 md:grid-cols-[1fr_320px] md:gap-16 items-start">
        <div>
          <p
            className="text-xl md:text-2xl leading-[1.55] font-light tracking-tight"
            style={{ color: 'color-mix(in srgb, var(--fg) 90%, transparent)' }}
          >
            {bio}
          </p>
          {skills.length ? (
            <div className="mt-10 flex flex-wrap gap-2">
              {skills.map((s) => (
                <MonoPill key={s} variant="default">
                  {s}
                </MonoPill>
              ))}
            </div>
          ) : null}
        </div>

        {avatarUrl && avatarAlt ? (
          <figure className="relative">
            <div
              className="relative overflow-hidden rounded-md border"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            >
              <Image
                src={avatarUrl}
                alt={avatarAlt}
                width={800}
                height={800}
                loading="lazy"
                unoptimized
                sizes="(max-width: 768px) 100vw, 320px"
                className="w-full h-auto object-cover aspect-square"
              />
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent)' }}
              />
            </div>
            <div
              className="bp-mono mt-3 flex justify-between text-[10px] tracking-wider uppercase"
              style={{ color: 'var(--muted-fg)' }}
            >
              <span>// PORTRAIT</span>
              <span>01 / 01</span>
            </div>
          </figure>
        ) : null}
      </div>
    </SectionShell>
  );
}
