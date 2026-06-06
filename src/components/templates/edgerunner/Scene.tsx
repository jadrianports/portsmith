/**
 * edgerunner/Scene.tsx — the HEAVY R3F canvas chunk (PIPE-09 / D-03 / D-04 / D-08;
 * RESEARCH §2 + §3; PATTERNS "edgerunner/Scene.tsx — NEW PATTERN").
 *
 * This is the ~235 kB gz lazy chunk that the `{ ssr: false }` boundary in
 * `./HoloShape` loads after paint — and the ONLY file in `edgerunner/` that imports
 * `three`/`@react-three/*`. It is reachable solely through that lazy boundary, so it
 * never enters the public First Load JS; it is bounded instead by the separate
 * async-island cap (`ASYNC_ISLAND_CAP_BYTES`, check-bundle-budget.ts).
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ LOAD-BEARING (RESEARCH §2 / T-13-03-DOS):                                     │
 * │ NAMED imports ONLY. NEVER `import * as THREE from 'three'` — the namespace    │
 * │ import does not tree-shake and would balloon the chunk past the cap. drei's   │
 * │ named `Icosahedron`/`Torus`/`AdaptiveDpr` tree-shake to near-nothing; `Mesh`  │
 * │ is a type-only import (zero runtime cost).                                    │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * The geometry, lights, materials, emissive neon colors, and rotation deltas are
 * translated 1:1 from the untrusted export
 * (`lovable-exports/synthwave-founder/src/components/3d/HoloShape.tsx:6-52`, D-03).
 * The D-04 edge hardening (offscreen-pause, reduced-motion freeze, no-WebGL
 * fallback) is the engineering value the export ignores — the scene is ADDITIVE
 * progressive enhancement, and its absence is never a broken page (the scoped
 * `.tmpl-edgerunner` CSS synthwave backdrop, plan 04, paints underneath).
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Icosahedron, Torus, AdaptiveDpr } from '@react-three/drei';
import type { Mesh } from 'three';

/**
 * The animated wireframe centerpiece: an emissive magenta Icosahedron orbited by two
 * thin neon Tori (cyan + violet), under two colored point lights + ambient fill.
 * Translated verbatim from the export. The rotation runs every frame UNLESS `paused`
 * — set true when the canvas is offscreen (INP protection) or under
 * `prefers-reduced-motion` (the meshes then render one static frame and never spin,
 * D-04). Pausing the rotation (rather than toggling the Canvas frameloop) keeps the
 * GL context alive so re-entry does not flash.
 */
function Wire({ paused }: { paused: boolean }) {
  const a = useRef<Mesh>(null);
  const b = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (paused) return; // offscreen / reduced-motion freeze (D-04)
    if (a.current) {
      a.current.rotation.x += dt * 0.3;
      a.current.rotation.y += dt * 0.45;
    }
    if (b.current) {
      b.current.rotation.x -= dt * 0.25;
      b.current.rotation.z += dt * 0.35;
    }
  });
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 3]} intensity={2} color="#ff3df0" />
      <pointLight position={[-3, -2, -2]} intensity={2} color="#22e8ff" />
      <Icosahedron ref={a} args={[1.15, 1]}>
        <meshStandardMaterial color="#ff2bd6" emissive="#ff2bd6" emissiveIntensity={0.55} wireframe />
      </Icosahedron>
      <Torus ref={b} args={[1.7, 0.02, 16, 96]}>
        <meshBasicMaterial color="#22e8ff" />
      </Torus>
      <Torus args={[2.1, 0.012, 16, 96]} rotation={[Math.PI / 3, 0, 0]}>
        <meshBasicMaterial color="#b46bff" />
      </Torus>
    </>
  );
}

/**
 * The Canvas host. Renders the export's camera/dpr settings + the D-04 hardening:
 *
 *   • `frameloop="always"` (D-08 discretion) — the continuous auto-rotation needs a
 *     frame every tick. `demand` would render ONE frame and then freeze (it only
 *     re-renders on a React state change), so it is wrong for an auto-animating scene.
 *     The perf strategy is `always` + manual offscreen-pause + a DPR cap, NOT `demand`.
 *
 *   • IntersectionObserver offscreen-pause — `paused` flips true when the canvas host
 *     leaves the viewport, so `useFrame` skips the rotation work while scrolled past
 *     (INP protection). The GL context stays alive (we pause the loop, not the Canvas).
 *
 *   • `prefers-reduced-motion` freeze — `reduced` (read once at mount, SSR-safe via the
 *     `typeof window` guard) forces the static first frame; combined with `paused` it is
 *     passed to `<Wire/>` so the scene never animates for motion-sensitive users (D-04).
 *
 *   • `dpr={[1, 2]}` + `<AdaptiveDpr pixelated />` — caps the device-pixel-ratio cost on
 *     retina/mobile and drops it further under load (INP). The export's value, kept 1:1.
 *
 *   • `fallback={<div aria-hidden />}` — R3F's no-WebGL hook. If the GL context cannot be
 *     created (no WebGL / context-loss), this renders instead of the canvas and the CSS
 *     synthwave backdrop shows through — the page is complete without WebGL (D-04).
 */
export function Scene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  // prefers-reduced-motion → static first frame (D-04). Read once; the `typeof window`
  // guard is belt-and-suspenders (this is a {ssr:false} client chunk, but the guard
  // keeps it safe if ever rendered in a non-DOM context).
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Offscreen-pause: pause the rotation loop when the canvas host leaves the viewport
  // (D-04 / INP). Pause the loop rather than unmount/re-create the Canvas so the GL
  // context survives and re-entry does not flash.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setPaused(!entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(host);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={hostRef} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 2]}
        frameloop="always"
        fallback={<div aria-hidden />}
      >
        <AdaptiveDpr pixelated />
        <Wire paused={paused || reduced} />
      </Canvas>
    </div>
  );
}
