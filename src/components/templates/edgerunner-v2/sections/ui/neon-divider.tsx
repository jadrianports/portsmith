/**
 * NeonDivider for edgerunner-v2 — bar-for-bar port of
 * lovable-exports/synthwave-founder/src/components/ui/NeonDivider.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout classes VERBATIM from export JSX.
 *   2. Color border/bg → inline style with scoped var(--token).
 *   3. Custom classes (font-mono-retro, text-glow-cyan, text-neon-cyan) KEPT AS-IS.
 *   4. SERVER COMPONENT — no 'use client', no motion (bundle-budget; D-25 / TMPL-04).
 *      The export's divider motion was `initial={false}` + `animate={{scaleX:1,opacity:1}}`,
 *      i.e. the bars render AT REST (scaleX:1, opacity:1) with no visible entrance — the
 *      `m.*` islands were pulling `motion/react` into First Load JS for nothing. Converted
 *      to plain `div`s (pixel-identical at rest; the parity capture is reduced-motion).
 */
export function NeonDivider({
  glyph = '◆',
  className,
}: {
  glyph?: string;
  className?: string;
}) {
  return (
    <div
      className={['relative mx-auto my-2 flex max-w-6xl items-center gap-4 px-6', className]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <div
        className="h-px flex-1 origin-right"
        style={{
          backgroundImage:
            'linear-gradient(to right, transparent, var(--neon-pink), var(--neon-purple), transparent)',
          boxShadow: '0 0 8px var(--neon-pink)',
        }}
      />
      <span className="font-mono-retro text-neon-cyan text-glow-cyan text-lg">{glyph}</span>
      <div
        className="h-px flex-1 origin-left"
        style={{
          backgroundImage:
            'linear-gradient(to right, transparent, var(--neon-cyan), var(--neon-purple), transparent)',
          boxShadow: '0 0 8px var(--neon-cyan)',
        }}
      />
    </div>
  );
}
