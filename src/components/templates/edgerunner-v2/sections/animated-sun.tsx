'use client';
/**
 * AnimatedSun — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/components/sections/AnimatedSun.tsx
 *
 * CHANGES FROM EXPORT:
 *   - `framer-motion` → `motion/react` (same API, ALL motion values VERBATIM)
 *   - Tailwind color utilities for neon colors → inline style with var(--token):
 *     bg-neon-pink → background: 'var(--neon-pink)'
 *     bg-neon-cyan → background: 'var(--neon-cyan)'
 *   - Tailwind structural classes KEPT VERBATIM (pointer-events-none, absolute, rounded-full,
 *     blur-3xl, mix-blend-screen, opacity-40, inset-0, absolute)
 *
 * NOTE: AnimatedSun is NOT directly used in the Hero section (the Hero backdrop is
 * CityScene). This component exists for potential future use in other sections.
 */
import { motion, useReducedMotion } from 'motion/react';

export function AnimatedSun() {
  const reduce = useReducedMotion();

  const sliceMask =
    'radial-gradient(circle at 50% 40%, black 0%, black 78%, transparent 80%), linear-gradient(to bottom, transparent 0%, transparent 52%, black 60%, black 100%)';

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[34%] h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2"
      aria-hidden="true"
    >
      {/* outer glow halo — breathes */}
      <motion.div
        className="absolute inset-0 -z-10 rounded-full blur-3xl"
        style={{ background: 'var(--neon-pink)' }}
        initial={{ scale: 1, opacity: 0.55 }}
        animate={reduce ? { opacity: 0.7 } : { scale: [1, 1.08, 1], opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* secondary cyan halo (chromatic aberration) */}
      <motion.div
        className="absolute inset-0 -z-10 rounded-full blur-3xl mix-blend-screen"
        style={{ background: 'var(--neon-cyan)', opacity: 0.18 }}
        animate={reduce ? {} : { x: [-3, 3, -3] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* sun disc — slow rotation */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, var(--neon-yellow) 0%, var(--neon-pink) 45%, var(--neon-purple) 75%, transparent 80%)',
          filter: 'blur(1px)',
        }}
        animate={reduce ? {} : { rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      />

      {/* chromatic offset ghost (pink) */}
      <motion.div
        className="absolute inset-0 rounded-full mix-blend-screen opacity-40"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, transparent 60%, var(--neon-pink) 78%, transparent 82%)',
        }}
        animate={reduce ? {} : { x: [-2, 2, -2] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* base slice layer — scrolls downward */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, var(--bg-deep) 0px, var(--bg-deep) 3px, transparent 3px, transparent 16px)',
          backgroundSize: '100% 19px',
          WebkitMaskImage: sliceMask,
          WebkitMaskComposite: 'source-in',
          maskImage: sliceMask,
          maskComposite: 'intersect',
        }}
        animate={reduce ? {} : { backgroundPositionY: ['0px', '19px'] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
      />

      {/* parallax slice layer — slower, fainter, wider gaps */}
      <motion.div
        className="absolute inset-0 rounded-full opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, color-mix(in oklab, var(--bg-deep) 80%, transparent) 0px, color-mix(in oklab, var(--bg-deep) 80%, transparent) 2px, transparent 2px, transparent 32px)',
          backgroundSize: '100% 34px',
          WebkitMaskImage: sliceMask,
          WebkitMaskComposite: 'source-in',
          maskImage: sliceMask,
          maskComposite: 'intersect',
        }}
        animate={reduce ? {} : { backgroundPositionY: ['0px', '34px'] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
      />

      {/* orbiting sparks */}
      {!reduce && (
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
        >
          {[0, 60, 120, 180, 240, 300].map((deg, i) => (
            <span
              key={deg}
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: i % 2 === 0 ? 'var(--neon-cyan)' : 'var(--neon-pink)',
                boxShadow:
                  i % 2 === 0
                    ? '0 0 8px var(--neon-cyan), 0 0 16px var(--neon-cyan)'
                    : '0 0 8px var(--neon-pink), 0 0 16px var(--neon-pink)',
                transform: `rotate(${deg}deg) translateY(-13rem)`,
              }}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
