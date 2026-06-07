'use client';
// src/components/templates/edgerunner/sections/ui/neon-divider.tsx
// Client Component — uses motion for a scale-in entrance (decorative, aria-hidden).
// Ported from lovable-exports/synthwave-founder/src/components/ui/NeonDivider.tsx
// R1: framer-motion → motion/react. R3: all values via var(--token) or CSS classes.
// R5: purely decorative (aria-hidden="true"); scale-in entrance is fine; reduced-motion
//     gated (renders full-width static when reduced-motion is true).
// R6: 'use client' required for motion hooks.
import { motion, useReducedMotion } from 'motion/react';

type Props = {
  glyph?: string;
  className?: string;
};

export function NeonDivider({ glyph = '◆', className }: Props) {
  const prefersReduced = useReducedMotion();

  const ruleInitial = prefersReduced
    ? { scaleX: 1, opacity: 1 }
    : { scaleX: 0, opacity: 0 };

  const ruleAnimate = { scaleX: 1, opacity: 1 };

  const ruleTransition = { duration: 0.9, ease: 'easeOut' as const };

  return (
    <div
      className={['tmpl-neon-divider', className].filter(Boolean).join(' ')}
      style={{
        position: 'relative',
        margin: '8px auto',
        display: 'flex',
        maxWidth: '72rem',
        alignItems: 'center',
        gap: '16px',
        padding: '0 24px',
      }}
      aria-hidden="true"
    >
      {/* Left rule — origin: right center — gradient pink→purple→transparent */}
      <motion.div
        className="tmpl-divider-rule-left"
        initial={ruleInitial}
        whileInView={ruleAnimate}
        viewport={{ once: true, margin: '-80px' }}
        transition={ruleTransition}
      />

      {/* Center glyph */}
      <span className="tmpl-divider-glyph">{glyph}</span>

      {/* Right rule — origin: left center — gradient transparent→cyan→purple */}
      <motion.div
        className="tmpl-divider-rule-right"
        initial={ruleInitial}
        whileInView={ruleAnimate}
        viewport={{ once: true, margin: '-80px' }}
        transition={ruleTransition}
      />
    </div>
  );
}
