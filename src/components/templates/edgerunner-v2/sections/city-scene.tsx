'use client';
/**
 * CityScene — hero backdrop (edgerunner-v2).
 * Bar-for-bar transcription of lovable-exports/synthwave-founder/src/components/sections/CityScene.tsx.
 *
 * CHANGES FROM EXPORT:
 *   - `framer-motion` → `motion/react` (same API, same motion values verbatim)
 *   - `@/assets/hero-city.jpg` → Next.js `<Image>` from `/templates/edgerunner/hero-city.jpg`
 *     (re-using the existing edgerunner city image asset — same art)
 *   - `bg-gradient-to-t from-background via-background/85 to-transparent` Tailwind utility
 *     → inline style with var(--bg) tokens (Tailwind color utilities reference export palette,
 *     not Portsmith scoped world)
 *
 * All motion values are VERBATIM from the export.
 */
import { m } from 'motion/react';
import Image from 'next/image';

const beams = [
  { left: '12%', color: 'var(--neon-pink)',    delay: 0,   h: '55%', w: 2 },
  { left: '27%', color: 'var(--neon-purple)',  delay: 0.8, h: '70%', w: 1 },
  { left: '41%', color: 'var(--neon-pink)',    delay: 1.6, h: '60%', w: 2 },
  { left: '58%', color: 'var(--neon-magenta)', delay: 0.4, h: '78%', w: 1 },
  { left: '71%', color: 'var(--neon-pink)',    delay: 2.1, h: '52%', w: 2 },
  { left: '86%', color: 'var(--neon-purple)',  delay: 1.2, h: '66%', w: 1 },
];

export function CityScene() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* base image */}
      <Image
        src="/templates/edgerunner/hero-city.jpg"
        alt=""
        fill
        priority
        unoptimized
        className="absolute inset-0 h-full w-full object-cover object-bottom"
        style={{ filter: 'saturate(1.15) contrast(1.05)' }}
      />

      {/* soft horizon glow pulse — VERBATIM motion values from export */}
      <m.div
        className="absolute left-1/2 top-[55%] h-[55%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at center, color-mix(in oklab, var(--neon-pink) 55%, transparent) 0%, color-mix(in oklab, var(--neon-purple) 25%, transparent) 45%, transparent 70%)',
          mixBlendMode: 'screen',
        }}
        animate={{ opacity: [0.55, 0.85, 0.55], scale: [1, 1.06, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* animated neon beams — VERBATIM motion values from export */}
      {beams.map((b, i) => (
        <m.div
          key={i}
          className="absolute bottom-[28%]"
          style={{
            left: b.left,
            width: b.w,
            height: b.h,
            background: `linear-gradient(to top, ${b.color}, transparent)`,
            boxShadow: `0 0 14px ${b.color}, 0 0 32px ${b.color}`,
            mixBlendMode: 'screen',
          }}
          animate={{ opacity: [0.25, 1, 0.25], scaleY: [0.85, 1.05, 0.85] }}
          transition={{
            duration: 3.2 + (i % 3),
            repeat: Infinity,
            ease: 'easeInOut',
            delay: b.delay,
          }}
        />
      ))}

      {/* drifting star/particle layer — VERBATIM from export */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 20px 30px, white, transparent), radial-gradient(1px 1px at 120px 80px, white, transparent), radial-gradient(1.5px 1.5px at 250px 50px, white, transparent), radial-gradient(1px 1px at 380px 140px, white, transparent), radial-gradient(1px 1px at 480px 30px, white, transparent)',
          backgroundSize: '520px 220px',
          maskImage: 'linear-gradient(to bottom, black 0%, black 45%, transparent 70%)',
        }}
      />

      {/* chromatic aberration sweep — VERBATIM motion values from export */}
      <m.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, color-mix(in oklab, var(--neon-cyan) 6%, transparent) 50%, transparent 100%)',
          mixBlendMode: 'screen',
        }}
        animate={{ y: ['-100%', '100%'] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
      />

      {/* bottom blend to dark background */}
      <div
        className="absolute inset-x-0 bottom-0 h-[42%]"
        style={{
          background:
            'linear-gradient(to top, var(--bg) 0%, color-mix(in srgb, var(--bg) 85%, transparent) 55%, transparent 100%)',
        }}
      />
    </div>
  );
}
