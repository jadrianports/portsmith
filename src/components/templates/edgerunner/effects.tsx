/**
 * edgerunner/effects.tsx — the two KEPT synthwave a11y effects (D-07), both
 * reduced-motion-gated, ZERO animation-lib install (CSS / rAF only — no `motion`, no
 * `framer-motion`; the install was deliberately skipped in plan 01). Translated from the
 * export's `layout/PowerOnFlash.tsx` + `layout/CursorTrail.tsx`; the export's
 * `CommandPalette.tsx` (cmdk) is DROPPED (D-07 — pointless on a single scroll, not
 * installed, not on the allowlist).
 *
 * MOUNTED in `edgerunner/index.tsx` as `<EdgerunnerEffects/>` (a Server Component can
 * render a 'use client' child). The mount is NOT reduced-motion-conditional at the RSC
 * level — the effects self-gate internally (so the RSC graph stays static + cacheable,
 * and the a11y gate, which runs under reduced-motion, sees the effects gate OFF).
 *
 * GATES (T-13-04-FLASH / WCAG 2.3.1):
 *   - PowerOnFlash: a ONE-SHOT CRT boot fade (a single soft opacity fade, NOT a hard
 *     strobe → well under 3 flashes/sec). Gated OFF entirely under
 *     `prefers-reduced-motion: reduce`. A sessionStorage "booted" guard fires it once
 *     per session. The fade itself is the scoped `@keyframes tmpl-edgerunner-poweron`
 *     in theme.css (one opacity ramp 0.85 → 0), reduced-motion-zeroed by the blanket
 *     reset (defence in depth).
 *   - CursorTrail: a glow that lerp-follows the cursor via a small rAF loop (NO motion
 *     lib — RESEARCH §5 recommendation (b)/(c), keeps First Load JS ≤200 / D-05). Gated
 *     by BOTH `prefers-reduced-motion: reduce` AND `(pointer: coarse)` — it mounts
 *     NOTHING on touch / reduced-motion (the export already does the coarse gate).
 */
'use client';

import { useEffect, useRef, useState } from 'react';

/** True when the user has NOT asked to reduce motion (SSR-safe). */
function prefersMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** True when this is a fine pointer (mouse) device, not a coarse (touch) one. */
function hasFinePointer(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return !window.matchMedia('(pointer: coarse)').matches;
}

/**
 * PowerOnFlash — a one-shot CRT boot fade overlay. Renders an absolutely-positioned
 * full-screen overlay that wears the scoped `tmpl-edgerunner-poweron` fade animation
 * for ~1s, then unmounts. Gated OFF under reduced-motion + a once-per-session guard.
 */
function PowerOnFlash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Gate: reduced-motion OFF + once-per-session.
    if (!prefersMotion()) return;
    try {
      if (sessionStorage.getItem('edgerunner-crt-booted')) return;
      sessionStorage.setItem('edgerunner-crt-booted', '1');
    } catch {
      // sessionStorage can throw (private mode / disabled storage) — degrade to
      // firing once per mount rather than crashing; still a single soft fade.
    }
    setShow(true);
    const t = window.setTimeout(() => setShow(false), 1000);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        pointerEvents: 'none',
        // The CRT boot wash: a neon-cyan tinted veil over the dark canvas that fades.
        background:
          'radial-gradient(120% 90% at 50% 0%, color-mix(in oklab, var(--neon-cyan) 22%, transparent), transparent 60%), var(--bg)',
        // ONE soft opacity fade (NOT a strobe) — the scoped keyframes in theme.css.
        animation: 'tmpl-edgerunner-poweron 1s ease-out forwards',
      }}
    />
  );
}

/**
 * CursorTrail — a neon glow that lerp-follows the cursor via a small rAF loop (no
 * animation lib). Mounts NOTHING under reduced-motion OR on a coarse pointer.
 */
function CursorTrail() {
  const [enabled, setEnabled] = useState(false);
  const glowRef = useRef<HTMLDivElement>(null);
  // Target (the real cursor) + the eased position (the lerp-followed glow).
  const target = useRef({ x: -200, y: -200 });
  const pos = useRef({ x: -200, y: -200 });
  const raf = useRef<number | null>(null);

  useEffect(() => {
    // Gate: BOTH reduced-motion OFF and a fine pointer (mouse). Touch / reduced-motion
    // mounts nothing (the export's coarse gate + the a11y requirement).
    if (!prefersMotion() || !hasFinePointer()) return;
    setEnabled(true);

    const onMove = (e: MouseEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
    };

    const tick = () => {
      // Linear-interpolate toward the cursor (the spring-like ease, no lib).
      pos.current.x += (target.current.x - pos.current.x) * 0.18;
      pos.current.y += (target.current.y - pos.current.y) * 0.18;
      const el = glowRef.current;
      if (el) {
        el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%)`;
      }
      raf.current = window.requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    raf.current = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf.current !== null) window.cancelAnimationFrame(raf.current);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      ref={glowRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 70,
        width: '288px',
        height: '288px',
        borderRadius: 'var(--radius-full)',
        opacity: 0.4,
        filter: 'blur(48px)',
        pointerEvents: 'none',
        background: 'radial-gradient(circle, var(--neon-pink), transparent 65%)',
      }}
    />
  );
}

/**
 * The single wrapper the RSC root mounts. Renders both kept effects; each self-gates
 * internally (reduced-motion / pointer-coarse), so under reduced-motion this renders
 * nothing visible (the a11y gate stays green). Zero animation-lib footprint.
 */
export function EdgerunnerEffects() {
  return (
    <>
      <PowerOnFlash />
      <CursorTrail />
    </>
  );
}
