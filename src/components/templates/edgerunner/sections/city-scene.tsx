/**
 * CityScene — the hero's full-bleed animated backdrop (Server Component, zero client JS).
 * Ported faithfully from `lovable-exports/synthwave-founder/src/components/sections/CityScene.tsx`.
 *
 * LAYERS (bottom → top):
 *  1. Base city photo (`next/image` fill, saturate/contrast filter)
 *  2. Soft sun / horizon glow bloom (radial-gradient, tmpl-edgerunner-float pulse)
 *  3. Six staggered vertical neon beams (tmpl-edgerunner-neon-pulse per beam)
 *  4. Drifting starfield (CSS radial-gradient dots, masked to sky half)
 *  5. Chromatic aberration sweep (tmpl-edgerunner-scanline, 9s linear)
 *  6. Bottom dark blend-to-background (gradient-to-t from var(--bg))
 *
 * DECORATIVE CONTRACT:
 *  - `aria-hidden="true"` + `pointerEvents:'none'` — invisible to AT, no interaction.
 *  - NO `'use client'` — pure Server Component; all motion is CSS keyframes from theme.css.
 *  - ALL colors via `var(--neon-*)` / `var(--bg)` tokens. Only `black`/`transparent`
 *    keywords are used in mask gradients (alpha channels, not UI colors — per task spec).
 *  - `@media (prefers-reduced-motion: reduce)` in theme.css zeroes every animation here.
 *
 * PARENT REQUIREMENT: the parent hero element must be `position: relative` (or absolute/fixed)
 * so the `fill` Image and absolute children resolve against it.
 */
import Image from 'next/image';

/** Beam definition — mirrors the export's `beams` array exactly (left%, color token, delay, height%, width px). */
const beams: Array<{
  left: string;
  color: string;
  delay: string;
  h: string;
  w: number;
  dur: string;
}> = [
  { left: '12%', color: 'var(--neon-pink)',    delay: '0s',    h: '55%', w: 2, dur: '3.2s' },
  { left: '27%', color: 'var(--neon-purple)',  delay: '0.8s',  h: '70%', w: 1, dur: '4.2s' },
  { left: '41%', color: 'var(--neon-pink)',    delay: '1.6s',  h: '60%', w: 2, dur: '5.2s' },
  { left: '58%', color: 'var(--neon-magenta)', delay: '0.4s',  h: '78%', w: 1, dur: '3.6s' },
  { left: '71%', color: 'var(--neon-pink)',    delay: '2.1s',  h: '52%', w: 2, dur: '4.2s' },
  { left: '86%', color: 'var(--neon-purple)',  delay: '1.2s',  h: '66%', w: 1, dur: '4.4s' },
];

export function CityScene() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* ── Layer 1: base city photograph (LCP, eager) ── */}
      {/*
       * `fill` requires the parent to be positioned (position: relative|absolute|fixed|sticky).
       * `unoptimized` — no Sharp / server image processing (CLAUDE.md constraint).
       * `priority` — this is above the fold / LCP element.
       * Empty alt — decorative image, aria-hidden on parent already hides it from AT.
       */}
      <Image
        src="/templates/edgerunner/hero-city.jpg"
        alt=""
        fill
        priority
        unoptimized
        style={{
          objectFit: 'cover',
          objectPosition: 'bottom',
          filter: 'saturate(1.15) contrast(1.05)',
        }}
      />

      {/* ── Layer 2: soft sun / horizon glow pulse ── */}
      {/*
       * Radial bloom centered at ~55% from top (horizon line of the city photo).
       * Animates with tmpl-edgerunner-float (6s translateY bob) for a gentle breathing pulse.
       * mixBlendMode: screen makes this additive — blends naturally over the photo.
       * The color-mix values reproduce the export's 55% pink / 25% purple ellipse.
       */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '55%',
          width: '80%',
          height: '55%',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          filter: 'blur(48px)',
          background:
            'radial-gradient(ellipse at center, color-mix(in oklab, var(--neon-pink) 55%, transparent) 0%, color-mix(in oklab, var(--neon-purple) 25%, transparent) 45%, transparent 70%)',
          mixBlendMode: 'screen',
          animation: 'tmpl-edgerunner-float 6s ease-in-out infinite',
        }}
      />

      {/* ── Layer 3: staggered vertical neon beams ── */}
      {/*
       * Six beams, each at the export's exact left% / height% / width-px.
       * linear-gradient(to top, color, transparent) → beam fades out at top.
       * box-shadow drives the neon glow on the beam edge.
       * tmpl-edgerunner-neon-pulse pulses the box-shadow (pink→cyan) per beam,
       * with per-beam animationDelay to stagger the pulses.
       * bottom: 28% anchors beam bases at the city roofline (export exact value).
       * mixBlendMode: screen keeps them additive over the photo.
       */}
      {beams.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: '28%',
            left: b.left,
            width: `${b.w}px`,
            height: b.h,
            background: `linear-gradient(to top, ${b.color}, transparent)`,
            boxShadow: `0 0 14px ${b.color}, 0 0 32px ${b.color}`,
            mixBlendMode: 'screen',
            animation: `tmpl-edgerunner-neon-pulse ${b.dur} ease-in-out infinite`,
            animationDelay: b.delay,
          }}
        />
      ))}

      {/* ── Layer 4: drifting starfield / particle layer ── */}
      {/*
       * Five radial-gradient dots at fixed positions, tiled at 520×220px.
       * maskImage clips the starfield to the top ~45% of the frame (sky zone),
       * fading out before the roofline so it doesn't compete with the beams.
       * `black`/`transparent` here are mask-channel alpha keywords, not UI colors.
       * opacity:0.6 matches the export.
       */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.6,
          backgroundImage:
            'radial-gradient(1px 1px at 20px 30px, white, transparent), ' +
            'radial-gradient(1px 1px at 120px 80px, white, transparent), ' +
            'radial-gradient(1.5px 1.5px at 250px 50px, white, transparent), ' +
            'radial-gradient(1px 1px at 380px 140px, white, transparent), ' +
            'radial-gradient(1px 1px at 480px 30px, white, transparent)',
          backgroundSize: '520px 220px',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 45%, transparent 70%)',
          maskImage: 'linear-gradient(to bottom, black 0%, black 45%, transparent 70%)',
        }}
      />

      {/* ── Layer 5: chromatic aberration sweep ── */}
      {/*
       * A translucent cyan band that drifts from top to bottom (tmpl-edgerunner-scanline:
       * translateY -100% → +100%, 9s linear infinite). Matches the export's `y: ["-100%","100%"]`
       * motion transition. mixBlendMode: screen keeps it additive.
       */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, transparent 0%, color-mix(in oklab, var(--neon-cyan) 6%, transparent) 50%, transparent 100%)',
          mixBlendMode: 'screen',
          animation: 'tmpl-edgerunner-scanline 9s linear infinite',
        }}
      />

      {/* ── Layer 6: bottom dark gradient blend ── */}
      {/*
       * Fades the city photo into var(--bg) at the bottom (42% height, same as export).
       * This blends the backdrop seamlessly into the grid / foreground content below.
       * Two stops mirror the export's `from-background via-background/85 to-transparent`.
       */}
      <div
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          bottom: 0,
          top: 'auto',
          height: '42%',
          background:
            'linear-gradient(to top, var(--bg) 0%, color-mix(in srgb, var(--bg) 85%, transparent) 55%, transparent 100%)',
        }}
      />
    </div>
  );
}
