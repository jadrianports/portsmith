/**
 * About section — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/components/sections/About.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout classes VERBATIM from export JSX.
 *   2. Color classes → inline style with scoped var(--token):
 *      bg-gradient-neon → style={{ background: 'var(--gradient-neon)' }}
 *      shadow-neon-cyan → style={{ boxShadow: 'var(--shadow-neon-cyan)' }}
 *      border-neon-cyan/40 → color-mix(in oklab, var(--neon-cyan) 40%, transparent)
 *      bg-card/60 → color-mix(in srgb, var(--surface) 60%, transparent)
 *      border-neon-purple/30 → color-mix(in oklab, var(--neon-purple) 30%, transparent)
 *      text-foreground/85 → color-mix(in oklab, var(--fg) 85%, transparent)
 *      text-foreground/70 → color-mix(in oklab, var(--fg) 70%, transparent)
 *   3. Custom classes (holo-panel, text-glow-pink, font-mono-retro, font-display,
 *      text-neon-pink, text-neon-cyan, bg-gradient-neon, shadow-neon-cyan) KEPT AS-IS.
 *   4. DATA BINDING:
 *      profile.bio → about content bio
 *      portrait placeholder: derive initials from display_name prop
 *      profile.stats → stats prop (metrics items folded in from index.tsx)
 *      Real avatar: next/image guarded by isHttpImageSrc
 *   5. SERVER COMPONENT — no 'use client', no motion (bundle-budget; D-25 / TMPL-04).
 *      The export's section motion was `initial={false}` + `animate` = elements render AT
 *      REST (no visible entrance); the shared `ScrollReveal` kit wrapper already reveals the
 *      section on scroll. The redundant `m.*` islands were the only reason this was a client
 *      component — converting them to plain elements drops `motion/react` from First Load JS
 *      with ZERO static-render change (parity capture is `reducedMotion:'reduce'`).
 */
import Image from 'next/image';

import type { SectionProps } from './types';
import type { AboutContent } from '@/lib/validations';
import { isHttpImageSrc } from '@/lib/safe-image';
import { present } from './shared';
import { SectionHeading } from './ui/section-heading';

/** A single stat item (from metrics section folded in by index.tsx). */
export interface StatItem {
  value: string;
  label: string;
}

/** Additive props from index.tsx. */
export interface AboutExtraProps {
  initials?: string | null;
  stats?: StatItem[];
}

export function About({ section, initials, stats }: SectionProps & AboutExtraProps) {
  const content = (section?.content ?? null) as AboutContent | null;
  if (!content) return null;

  const bio = present(content.bio) ? content.bio : null;

  // D-08 host-lock: only Supabase Storage origins pass isHttpImageSrc.
  const avatarUrl = isHttpImageSrc(content.avatar) ? content.avatar : null;
  const avatarAlt = present(content.avatar_alt) ? content.avatar_alt : null;
  const hasRealAvatar = Boolean(avatarUrl && avatarAlt);

  const resolvedStats = stats && stats.length > 0 ? stats : [];

  // hide-if-empty: nothing meaningful → null
  if (!bio && !hasRealAvatar && resolvedStats.length === 0) return null;

  return (
    <section id="about" className="relative py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="About" title="Decoded" accent="cyan" />
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.4fr]">
          {/* Holographic portrait — LEFT column */}
          <div
            className="relative mx-auto aspect-[3/4] w-full max-w-xs"
          >
            <div
              className="absolute inset-0 rounded-2xl opacity-60 blur-2xl bg-gradient-neon"
            />
            <div
              className="holo-panel relative h-full rounded-2xl p-3 shadow-neon-cyan"
            >
              {hasRealAvatar ? (
                /* Real avatar — next/image, D-08 host-lock */
                <div className="relative h-full w-full rounded-xl overflow-hidden">
                  <Image
                    src={avatarUrl as string}
                    alt={avatarAlt as string}
                    fill
                    sizes="(max-width: 640px) 80vw, 320px"
                    unoptimized
                    style={{ objectFit: 'cover' }}
                  />
                  {/* CRT scanline overlay */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      backgroundImage:
                        'repeating-linear-gradient(to bottom, transparent 0, transparent 3px, color-mix(in oklab, var(--neon-cyan) 18%, transparent) 4px, transparent 5px)',
                    }}
                  />
                </div>
              ) : (
                /* Placeholder holographic card — VERBATIM from export */
                <div
                  className="grid h-full w-full place-items-center rounded-xl"
                  style={{
                    border: '1px solid color-mix(in oklab, var(--neon-cyan) 40%, transparent)',
                    background:
                      'linear-gradient(180deg, color-mix(in oklab, var(--neon-purple) 25%, transparent), color-mix(in oklab, var(--neon-pink) 20%, transparent))',
                    backgroundImage:
                      'repeating-linear-gradient(to bottom, transparent 0, transparent 3px, color-mix(in oklab, var(--neon-cyan) 18%, transparent) 4px, transparent 5px)',
                  }}
                >
                  <div className="text-center">
                    <div className="font-display text-7xl font-black text-neon-pink text-glow-pink">
                      {initials ?? '◈'}
                    </div>
                    <div className="mt-2 font-mono-retro text-neon-cyan text-base">
                      {'// avatar.holo'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT column — bio + stats grid */}
          <div>
            {bio ? (
              <p
                className="text-lg leading-relaxed"
                style={{ color: 'color-mix(in oklab, var(--fg) 85%, transparent)' }}
              >
                {bio}
              </p>
            ) : null}

            {/* STATS GRID — folded from metrics section (passed via prop from index.tsx) */}
            {resolvedStats.length > 0 ? (
              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {resolvedStats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl p-4 backdrop-blur-md"
                    style={{
                      border: '1px solid color-mix(in oklab, var(--neon-purple) 30%, transparent)',
                      background: 'color-mix(in srgb, var(--surface) 60%, transparent)',
                    }}
                  >
                    <div className="font-display text-3xl font-bold text-neon-pink text-glow-pink">
                      {s.value}
                    </div>
                    <div
                      className="mt-1 font-mono-retro text-base"
                      style={{ color: 'color-mix(in oklab, var(--fg) 70%, transparent)' }}
                    >
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
