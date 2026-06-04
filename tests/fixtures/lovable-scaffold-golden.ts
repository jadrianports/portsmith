/**
 * Re-export shim (W8 — Phase-10 Plan 02).
 *
 * The canonical golden-fixture content was RELOCATED src-side to
 * `src/lib/fixtures/lovable-scaffold-golden.ts` so the `__fixture` render route can
 * import it as `@/lib/fixtures/...` without pulling any `tests/` source into the Next
 * compilation graph (W8 / T-10-02-GRAPHLEAK). This file keeps the historical
 * `tests/fixtures/lovable-scaffold-golden` import path resolving UNCHANGED for the
 * Phase-9 consumer (`tests/unit/templates/scaffold-fixture.test.ts`) — it is a pure
 * re-export, nothing more.
 */
export * from '@/lib/fixtures/lovable-scaffold-golden';
