/**
 * B2 / D-P10-02 — the REAL unit RED proof for the async-island cap reject predicate.
 *
 * Phase 10 ships NO rich/viz-lane template, so the LIVE `.next/` async-chunk scan in
 * `check-bundle-budget.ts` legitimately has NOTHING to measure (minimal/editorial ship
 * no lazy `{ ssr: false }` scene chunk → the scan no-ops). That is fine — but a
 * "deferred stub that activates at Phase 13" would be a MOCK-RED that never exercises
 * the real cap-check code path and is therefore untrusted (D-P10-02 "prove RED").
 *
 * So the cap is implemented as an EXPORTED, pure predicate — `assertAsyncIslandWithinCap`
 * — and THIS test calls that ACTUAL predicate NOW with a SYNTHETIC over-cap byte length,
 * asserting it THROWS and that the thrown message NAMES the over-cap construct. The
 * under-cap companion assertion is the GREEN control. The predicate is imported from
 * `scripts/check-bundle-budget.ts` (the real gate module, not a copy), so this test
 * exercises the genuine reject logic — the Phase-10 RED proof the live scan cannot give.
 *
 * Pattern mirrors `scaffold-fixture.test.ts`'s NEGATIVE-CONTROL idiom: call the real
 * predicate with a known-bad input and assert it flags. Plain describe/it, no mocks.
 *
 * NOTE: the gate's CLI tail (`main()` → `next build`) is guarded by an
 * `import.meta.url === entry` check, so importing the module here does NOT run the gate.
 */
import { describe, expect, it } from 'vitest';

import {
  ASYNC_ISLAND_CAP_BYTES,
  assertAsyncIslandWithinCap,
} from '../../../scripts/check-bundle-budget';

describe('async-island cap reject predicate (B2 / D-P10-02 — PIPE-08 / CONTRACT §5)', () => {
  it('the cap is the Phase-13 tuned figure (320 kB gz — D-05 / RESEARCH §1)', () => {
    // Phase 10 shipped 250 kB as a starting figure; Phase 13 (the first rich-lane
    // template, edgerunner) tuned it to 320 kB gz = the measured ~235 kB esbuild
    // floor + ~36% headroom, inside the D-05 ~300–350 band (provisional pending the
    // plan-07 real-Turbopack-chunk re-evaluation).
    expect(ASYNC_ISLAND_CAP_BYTES).toBe(320 * 1024);
  });

  // --- RED: the real reject path, exercised NOW against a synthetic over-cap input ---
  it('THROWS on a synthetic over-cap scene chunk AND names the over-cap construct', () => {
    const overCap = ASYNC_ISLAND_CAP_BYTES + 1; // strictly over the 320 kB gz cap
    const label = 'richviz/scene-island';

    expect(() => assertAsyncIslandWithinCap(overCap, label)).toThrow();

    // The thrown message must NAME the over-cap construct (the label/slug) — a generic
    // "too big" without the offending construct would not let an operator find it.
    expect(() => assertAsyncIslandWithinCap(overCap, label)).toThrow(/richviz\/scene-island/);
    // ...and state that it EXCEEDS the cap (the magnitude vs the cap).
    expect(() => assertAsyncIslandWithinCap(overCap, label)).toThrow(/OVER the 320 kB/);
  });

  it('THROWS on a grossly-over-cap chunk (e.g. a 1 MB un-tree-shaken three.js import)', () => {
    expect(() => assertAsyncIslandWithinCap(1024 * 1024, 'richviz/three-barrel')).toThrow(
      /three-barrel/,
    );
  });

  it('THROWS on an invalid (negative / non-finite) size, naming the construct', () => {
    expect(() => assertAsyncIslandWithinCap(-1, 'richviz/bad')).toThrow(/richviz\/bad/);
    expect(() => assertAsyncIslandWithinCap(Number.NaN, 'richviz/nan')).toThrow(/richviz\/nan/);
  });

  // --- GREEN companion: an under-cap input does NOT throw (the predicate is not a no-op) ---
  it('does NOT throw on an under-cap scene chunk', () => {
    expect(() => assertAsyncIslandWithinCap(ASYNC_ISLAND_CAP_BYTES - 1, 'richviz/lean')).not.toThrow();
  });

  it('does NOT throw exactly AT the cap boundary (≤ cap passes)', () => {
    expect(() => assertAsyncIslandWithinCap(ASYNC_ISLAND_CAP_BYTES, 'richviz/boundary')).not.toThrow();
  });

  it('does NOT throw on a zero-byte / empty chunk', () => {
    expect(() => assertAsyncIslandWithinCap(0, 'richviz/empty')).not.toThrow();
  });
});
