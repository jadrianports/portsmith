/**
 * LAND-03 / D-12 (Phase 22, Plan 22-01, Wave 0) — the committed proof-asset existence gate.
 *
 * The landing-page proof block (D-03/D-04) shows TWO contrasting published portfolios via
 * committed STATIC screenshots (NOT live iframes — those load the full template bundle on `/`
 * and break the LAND-05 perf posture). D-12 locks these as committed assets under `/public`,
 * refreshed manually when a showcase changes (zero per-request cost):
 *   - `public/landing/showcase-dev.webp`    — the founder's developer portfolio (/jadrianports)
 *   - `public/landing/showcase-aurora.webp` — a marketer portfolio on the aurora template
 *
 * This asserts both assets are present on disk so a forgotten/renamed capture cannot ship a
 * broken proof block (a `<img src>` 404 on the front door).
 *
 * ── RED-TOLERANT NOW ──────────────────────────────────────────────────────────
 * Both `.webp`s are captured + committed in Plan 04 (the `capture-landing-proof.mjs` step,
 * after the aurora demo is seeded). Until then this is RED — it is the binding LAND-03
 * committed-asset gate that goes GREEN when the assets land.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/** The two committed proof screenshots (D-12), relative to repo root. */
const PROOF_ASSETS = [
  'public/landing/showcase-dev.webp',
  'public/landing/showcase-aurora.webp',
] as const;

describe('LAND-03 / D-12 — the committed proof screenshots exist under public/landing/', () => {
  it.each(PROOF_ASSETS)('%s exists on disk', (relPath) => {
    expect(
      existsSync(path.resolve(relPath)),
      `${relPath} is missing — the landing proof block (D-03/D-04) needs both committed ` +
        'showcase screenshots. Capture + commit them via the Plan-04 capture-landing-proof ' +
        'step (after the aurora demo portfolio is seeded). D-12 keeps these as static, ' +
        'manually-refreshed /public assets — a missing one would 404 the front-door proof img.',
    ).toBe(true);
  });
});
