'use client';
/**
 * TerminalCard — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/components/sections/TerminalCard.tsx
 *
 * CHANGES FROM EXPORT:
 *   - `framer-motion` → `motion/react` (same API, motion values VERBATIM)
 *   - Static `lines` array → `lines` prop (driven by real PortfolioData in hero.tsx)
 *   - `react-icons` brand icons → removed (terminal is text-only)
 *   - Tailwind color utilities (text-neon-pink, bg-neon-pink, text-neon-cyan, etc.)
 *     → inline style={{color:'var(--neon-pink)'}} etc.
 *   - CSS custom class `holo-panel` / `shadow-neon-pink` / `font-mono-retro` → kept as
 *     className strings (scoped under .tmpl-edgerunner-v2 in theme.css)
 *   - `animate-pulse` → inline animation with tmpl-edgerunner-v2-neon-pulse keyframe
 *   - Conic border spin → tmpl-edgerunner-v2-spin keyframe (theme.css)
 *   - SSR-safe: initializes revealedCount to lines.length (all shown); mount effect
 *     resets to 0 for the progressive typing reveal.
 */
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

export type TerminalCardProps = {
  lines: Array<{ p: string; c: string; out: string }>;
  className?: string;
};

export function TerminalCard({ lines, className }: TerminalCardProps) {
  const prefersReduced = useReducedMotion();

  // SSR-safe: start fully revealed; mount effect resets for typing animation
  const [shown, setShown] = useState(lines.length);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (prefersReduced) return;
    setShown(0);
  }, [prefersReduced]);

  useEffect(() => {
    if (prefersReduced) return;
    if (shown >= lines.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 700 + shown * 250);
    return () => clearTimeout(t);
  }, [shown, lines.length, prefersReduced]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, rotateY: -8 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      className={['holo-panel', className].filter(Boolean).join(' ')}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '28rem',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        boxShadow: 'var(--shadow-neon-pink)',
        perspective: 1000,
      }}
    >
      {/* animated conic border — VERBATIM from export */}
      <div
        aria-hidden="true"
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          borderRadius: 'var(--radius-lg)',
          padding: 1,
          background:
            'conic-gradient(from 0deg, var(--neon-pink), var(--neon-cyan), var(--neon-purple), var(--neon-pink))',
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          animation: 'tmpl-edgerunner-v2-spin 8s linear infinite',
          opacity: 0.55,
        }}
      />

      {/* title bar — VERBATIM structure from export */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid color-mix(in oklab, var(--neon-cyan) 20%, transparent)',
          paddingBottom: '12px',
          marginBottom: '16px',
        }}
      >
        {/* window control dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            aria-hidden="true"
            className="shadow-neon-pink"
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--neon-pink)',
            }}
          />
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--neon-yellow)',
            }}
          />
          <span
            aria-hidden="true"
            className="shadow-neon-cyan"
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--neon-cyan)',
            }}
          />
        </div>

        {/* EXACT titlebar text from export */}
        <div
          className="font-mono-retro"
          style={{
            fontSize: '1rem',
            color: 'color-mix(in oklab, var(--neon-cyan) 80%, transparent)',
          }}
        >
          ~/portfolio — zsh
        </div>

        {/* blinking status dot */}
        <span
          aria-hidden="true"
          className="shadow-neon-pink"
          style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--neon-pink)',
            animation: 'tmpl-edgerunner-v2-neon-pulse 1.2s ease-in-out infinite',
          }}
        />
      </div>

      {/* terminal body — VERBATIM line structure from export */}
      <div
        className="font-mono-retro"
        style={{
          marginTop: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontSize: '1.125rem',
          lineHeight: 1.25,
        }}
      >
        {lines.slice(0, shown).map((l, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div>
              <span style={{ color: 'var(--neon-pink)' }}>{l.p}</span>{' '}
              <span style={{ color: 'var(--fg)' }}>{l.c}</span>
            </div>
            <div style={{ paddingLeft: '12px', color: 'color-mix(in oklab, var(--neon-cyan) 90%, transparent)' }}>
              → {l.out}
            </div>
          </motion.div>
        ))}
        {shown < lines.length && (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              height: '16px',
              width: '8px',
              background: 'var(--neon-pink)',
              animation: 'tmpl-edgerunner-v2-neon-pulse 0.8s ease-in-out infinite',
              verticalAlign: 'middle',
            }}
          />
        )}
      </div>

      {/* live progress — VERBATIM from export */}
      <div
        style={{
          marginTop: '20px',
          borderTop: '1px solid color-mix(in oklab, var(--neon-cyan) 20%, transparent)',
          paddingTop: '12px',
        }}
      >
        <div
          className="font-mono-retro"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '1rem',
            color: 'color-mix(in oklab, var(--fg) 70%, transparent)',
            marginBottom: '8px',
          }}
        >
          <span>shipping_pixels.sh</span>
          <span style={{ color: 'var(--neon-cyan)' }}>running…</span>
        </div>
        <div
          style={{
            height: '6px',
            overflow: 'hidden',
            borderRadius: 'var(--radius-full)',
            background: 'color-mix(in oklab, var(--bg) 60%, transparent)',
            border: '1px solid var(--border)',
          }}
        >
          <motion.div
            initial={{ width: '10%' }}
            animate={{ width: '92%' }}
            transition={{ duration: 2.4, repeat: Infinity, repeatType: 'reverse' }}
            className="bg-gradient-neon"
            style={{ height: '100%' }}
          />
        </div>
      </div>
    </motion.div>
  );
}
