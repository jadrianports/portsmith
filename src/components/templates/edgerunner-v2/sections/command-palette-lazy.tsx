'use client';
/**
 * Lazy client wrapper for the ⌘K {@link CommandPalette} (bundle-budget island).
 *
 * WHY THIS EXISTS (D-25 / TMPL-04 ≤200 kB First Load JS):
 * The CommandPalette renders NOTHING until the user presses ⌘K / Ctrl+K (it returns
 * `null` while closed and only mounts its UI on open). It imports ~12 lucide-react
 * icons + its own modal/keyboard/scroll-lock logic — dead weight in the public
 * `/[username]` First Load JS for a control most visitors never trigger. Eagerly
 * bundled it pushed the route over the 200 kB gz budget.
 *
 * This wrapper defers the palette CODE to a separate async chunk via
 * `next/dynamic(..., { ssr: false })`, so its bytes leave the route's First Load JS.
 * The palette still works identically: this island mounts a tiny key/event listener
 * that loads the real palette chunk the first time ⌘K is pressed (or the navbar hint
 * dispatches `cmdk-open`), then forwards the open. There is ZERO render-time UI here
 * (the palette is closed-by-default), so the golden parity baseline is unaffected.
 *
 * `{ ssr: false }` is ONLY legal inside a Client Component (this file) — never on a
 * Server-Component template entry (registry.ts prohibition). This is the sanctioned
 * place for it (the same role the removed edgerunner HoloShape island once held).
 */
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import type { CommandPaletteProps } from './command-palette';

// Deferred to its own client chunk — kept OUT of the route's First Load JS until the
// visitor actually invokes ⌘K. `ssr: false` is valid here (Client Component).
const CommandPalette = dynamic(
  () => import('./command-palette').then((m) => m.CommandPalette),
  { ssr: false },
);

export function CommandPaletteLazy(props: CommandPaletteProps) {
  // `armed` flips true the first time the palette is invoked, which triggers the
  // dynamic import of the real palette chunk. Until then we render only the listener.
  const [armed, setArmed] = useState(false);

  // Arming listener — runs only while NOT yet armed. The invoking ⌘K / cmdk-open event
  // ARMS us (loads the chunk); once armed this effect detaches and the real palette
  // takes over its own listeners. We mount the palette with `initialOpen` so the SAME
  // invocation that armed us opens it immediately on mount — race-free (no reliance on a
  // re-dispatched event landing after the async chunk resolves + listener mounts).
  useEffect(() => {
    if (armed) return;
    const arm = () => setArmed(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        arm();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('cmdk-open', arm);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('cmdk-open', arm);
    };
  }, [armed]);

  if (!armed) return null;
  return <CommandPalette {...props} initialOpen />;
}
