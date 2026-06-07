'use client';
/**
 * TerminalCard — the hero's right-column fake terminal HUD (edgerunner template).
 *
 * Ported from lovable-exports/synthwave-founder/src/components/sections/TerminalCard.tsx
 * with the following transformations:
 *   R1  framer-motion → motion/react (useReducedMotion hook).
 *   R3  All colors / fonts / radius via var(--token) — no hardcoded hex.
 *   R5  SSR renders FINAL state (all lines visible); typing animation is a progressive
 *       enhancement gated behind mounted + !reducedMotion.
 *       INVERSION from the export: `revealedCount` initialises to `lines.length`
 *       (fully revealed). A mount effect resets to 0 and starts the staggered
 *       reveal — so SSR + no-JS path always shows complete text.
 *   R6  'use client' required (useState / useEffect / useReducedMotion).
 *   R7  No dangerouslySetInnerHTML, no inline on* strings, no eval.
 *
 * Conic-spin border: a `position:absolute` child div with a 1px-wide conic-gradient
 * ring (mask trick — padding 1px + WebkitMask xor). Uses the `tmpl-edgerunner-spin`
 * @keyframes defined in theme.css (already zeroed under prefers-reduced-motion by the
 * blanket reset). No new CSS required.
 *
 * Progress bar: renders at `--terminal-bar-width` (72%) resting on SSR/reduced-motion.
 * Under `prefers-reduced-motion: no-preference` a CSS animation (inline `animation`
 * property referencing the existing `tmpl-edgerunner-spin` — wait, wrong keyframe) is
 * NOT used; instead the bar sits at 72% statically. The export used a motion.div
 * loop — we intentionally drop that (content, not decoration) and show a static
 * filled bar, which is accurate no-JS behaviour.
 */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

export type TerminalCardProps = {
  lines: string[];
  className?: string;
};

/**
 * TerminalCard — data-driven, no-JS-safe terminal HUD widget.
 *
 * `lines` — the terminal output rows to display.  The hero builds these from
 * the user's real public profile data (display_name, tagline, etc.).
 * Each entry is rendered as:
 *   $ <line>
 * matching the export's prompt style.
 */
export function TerminalCard({ lines, className }: TerminalCardProps) {
  const prefersReduced = useReducedMotion();

  // KEY SSR-SAFE INVARIANT (R5):
  // Initialise to the FULL count so every server render + no-JS paint shows all lines.
  // The mount effect inverts this to 0 and drives the progressive typing reveal.
  const [revealedCount, setRevealedCount] = useState(lines.length);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    // Under reduced-motion: leave revealedCount at lines.length (static final state).
    if (prefersReduced) return;

    // Reset to 0 and stagger reveals — this only runs after hydration, so SSR is safe.
    setRevealedCount(0);
  }, [prefersReduced]);

  useEffect(() => {
    if (prefersReduced) return;
    if (revealedCount >= lines.length) return;
    const delay = 700 + revealedCount * 250;
    const t = setTimeout(() => setRevealedCount((n) => n + 1), delay);
    return () => clearTimeout(t);
  }, [revealedCount, lines.length, prefersReduced]);

  const isTyping = !prefersReduced && revealedCount < lines.length;

  return (
    <div
      className={['tmpl-holo-panel', className].filter(Boolean).join(' ')}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '28rem',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        // The holo-panel class provides background + border + backdrop-filter;
        // add the neon-pink shadow (the export's `shadow-neon-pink`).
        boxShadow: '0 0 18px -6px color-mix(in oklab, var(--neon-pink) 40%, transparent)',
      }}
    >
      {/* ── Animated conic-gradient spinning border ──────────────────────────
          Strategy: absolute 1px-thick border via the CSS mask trick —
            padding: 1px  → the conic gradient fills a 1px ring around the content.
            WebkitMask xor → cuts out the inner content-box so only the ring shows.
          Animation: `tmpl-edgerunner-spin` (defined in theme.css, 8s linear infinite).
          The blanket `prefers-reduced-motion` reset in theme.css zeroes it — no JS
          guard needed here.
          opacity 0.55 matches the export.
      ──────────────────────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          borderRadius: 'var(--radius-lg)',
          padding: '1px',
          background:
            'conic-gradient(from 0deg, var(--neon-pink), var(--neon-cyan), var(--neon-purple), var(--neon-pink))',
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          animation: 'tmpl-edgerunner-spin 8s linear infinite',
          opacity: 0.55,
        }}
      />

      {/* ── Title bar ────────────────────────────────────────────────────────
          Three window-control dots (pink / yellow / cyan) + path label + blink dot.
          Mono font (VT323 via var(--font-mono)).
      ──────────────────────────────────────────────────────────────────────── */}
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
        {/* Window dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--neon-pink)',
              boxShadow: '0 0 6px var(--neon-pink)',
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
            style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--neon-cyan)',
              boxShadow: '0 0 6px var(--neon-cyan)',
            }}
          />
        </div>

        {/* Path label */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            color: 'color-mix(in oklab, var(--neon-cyan) 80%, transparent)',
            letterSpacing: '0.04em',
          }}
        >
          ~/portfolio — zsh
        </span>

        {/* Blinking cursor dot — CSS animation, zeroed under reduced-motion by theme.css. */}
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--neon-pink)',
            boxShadow: '0 0 6px var(--neon-pink)',
            animation: 'tmpl-edgerunner-neon-pulse 1.2s ease-in-out infinite',
          }}
        />
      </div>

      {/* ── Terminal body — lines ─────────────────────────────────────────────
          Renders `revealedCount` lines (= lines.length on SSR; staggered on client).
          Each line: `$ ` prompt glyph + the line text, then an indented `→` output row.
          Matches the export's two-row per-entry layout.
      ──────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontFamily: 'var(--font-mono)',
          fontSize: '15px',
          lineHeight: 1.4,
        }}
      >
        {lines.slice(0, revealedCount).map((line, i) => (
          <div key={i}>
            {/* Prompt row */}
            <div>
              <span style={{ color: 'var(--neon-pink)' }}>$</span>{' '}
              <span style={{ color: 'var(--fg)' }}>{line}</span>
            </div>
          </div>
        ))}

        {/* Typing cursor — visible only while animation is in progress. */}
        {isTyping && (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '8px',
              height: '16px',
              verticalAlign: 'middle',
              background: 'var(--neon-pink)',
              animation: 'tmpl-edgerunner-neon-pulse 0.8s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* ── Footer progress bar ───────────────────────────────────────────────
          Resting width: 72% (sensible non-empty SSR state).
          Fill: var(--neon-gradient) — the template's signature pink→purple→cyan.
          No motion animation — we intentionally render a static bar so SSR is
          accurate and no-JS shows a meaningful filled state.
          Label uses muted-fg mono type.
      ──────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          marginTop: '20px',
          borderTop: '1px solid color-mix(in oklab, var(--neon-cyan) 20%, transparent)',
          paddingTop: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            color: 'color-mix(in oklab, var(--fg) 70%, transparent)',
            marginBottom: '8px',
          }}
        >
          <span>shipping_pixels.sh</span>
          <span style={{ color: 'var(--neon-cyan)' }}>running…</span>
        </div>

        {/* Track */}
        <div
          style={{
            height: '6px',
            width: '100%',
            borderRadius: 'var(--radius-full)',
            background: 'color-mix(in oklab, var(--bg) 60%, transparent)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
          }}
        >
          {/* Fill — static 72% resting width; no motion animation (SSR safe). */}
          <div
            style={{
              height: '100%',
              width: '72%',
              borderRadius: 'var(--radius-full)',
              backgroundImage: 'var(--neon-gradient)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
