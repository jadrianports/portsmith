'use client';
/**
 * `<EditPreviewBridgeMount/>` — the live-preview bridge's tiny layout-level trigger
 * (Phase 27 — EDIT-04 / D-02 / D-08). Mounted ONCE inside the `isEnabled` draft arm of
 * `(portfolio)/[username]/page.tsx`, it pulls the real bridge logic into the iframe
 * document — with ZERO public-bundle cost.
 *
 * WHY THIS SHAPE (load-bearing bundle discipline — the EXACT `beacon-mount.tsx` idiom,
 * Pitfall 3 / T-27-07): the bridge is only ever NEEDED in the owner's `?edit` iframe, but
 * the draft arm renders for any draft request. If this trigger imported the bridge
 * statically (or via `next/dynamic` render machinery), the bridge's code would land in
 * the shared client entry (`rootMainFiles`) that `check:bundle` sums against the public
 * First-Load-JS budgets. Instead it:
 *   - renders NOTHING and holds NO JSX child (no `next/dynamic` wrapper in the shared
 *     entry — that measurably inflates `rootMainFiles`);
 *   - imports `react` ONLY — never `@/lib/validations` (Zod) or
 *     `@/components/templates/registry` (both evaluate `z.enum(...)` at module scope);
 *   - lazily `import()`s `./edit-preview-bridge` ONLY in a browser effect, so the bridge
 *     loads in its OWN async chunk that is NOT part of `rootMainFiles` (the EDIT-04
 *     chunk-absence proof, `preview-bridge-chunk-absent.test.ts`).
 *
 * The lazily-loaded `startEditPreviewBridge` self-gates on `?edit` (it is inert without
 * the flag), so mounting this unconditionally inside the draft arm is safe: a plain
 * draft preview (no `?edit`) attaches nothing.
 */
import { useEffect } from 'react';

export function EditPreviewBridgeMount(): null {
  useEffect(() => {
    let teardown: (() => void) | undefined;
    let cancelled = false;

    // Lazy browser-only import — the bridge logic loads in its OWN async chunk,
    // OUTSIDE the layout's shared First Load JS (T-27-07). The bridge itself
    // self-gates on `?edit`, so this no-ops for a plain draft preview.
    void import('./edit-preview-bridge').then((m) => {
      if (cancelled) return;
      teardown = m.startEditPreviewBridge();
    });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return null; // renders nothing
}
