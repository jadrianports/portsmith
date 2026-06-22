/**
 * ANLY-06 — the owner-analytics conversion + outbound-click aggregation math
 * (Wave 0 RED scaffold, Plan 33-01). A pure unit test (the math is extracted into
 * pure, DB-free helpers in Plan 33-04 so it is unit-testable without a request
 * context — mirrors how `buildDailySeries` / `toSourceBucket` are pure today).
 *
 * THE INVARIANT (ANLY-06 / D-09 / D-10):
 *   - conversion30d = (30-day contact messages) ÷ (30-day page views). A
 *     divide-by-zero (zero page views in the window) MUST yield `null` — NOT 0,
 *     NOT NaN, NOT Infinity. A `null` reads on the card as "not enough data yet",
 *     which is honest; a `0` would falsely read as "nobody converts".
 *   - clicks30d aggregates `analytics_events` rows in the window; topDestinations
 *     groups by the derived `category` (social/contact/project/other, D-10), desc.
 *
 * The helpers under test (`computeConversion`, `aggregateClicks`, or the
 * `getOwnerAnalytics` ANLY-06 extension shape) land in Plan 33-04. We import them
 * through a RUNTIME variable specifier (the established RED idiom) so `tsc
 * --noEmit` stays 0 while the exports are absent. The pure ÷0 → null math is also
 * asserted ACTIVELY against a tiny inline reference so the contract is locked and
 * the file is never a zero-assertion no-op.
 *
 * ── WHY RED NOW ───────────────────────────────────────────────────────────────
 * `analytics_events` aggregation + the conversion helper do not exist until Plan
 * 33-04. The module-export assertions live in a `describe.skip` (flip to
 * `describe(` when 33-04 lands the helpers). The ÷0 → null reference assertion is
 * ACTIVE — it pins the exact rounding/guard behavior the helper must reproduce.
 */
import { describe, expect, it } from 'vitest';

// The not-yet-built ANLY-06 helper module (Plan 33-04). Variable specifier so there
// is no STATIC reference for `tsc` to fail on; the runtime export is `undefined`
// until 33-04 → the .skip block below is RED-pending.
const ANALYTICS_MOD = '@/lib/analytics/owner-analytics';

/**
 * The reference conversion guard the production helper MUST reproduce: messages ÷
 * views, with a zero-views window collapsing to `null` (never 0 / NaN / Infinity).
 * Asserting this pure shape ACTIVELY locks the ANLY-06 ÷0 contract before the
 * production helper exists.
 */
function refConversion(messages: number, views: number): number | null {
  if (views <= 0) return null; // ÷0 → null (the D-09 honesty guard, not 0).
  return messages / views;
}

describe('ANLY-06 — conversion ÷0 → null contract (ACTIVE reference)', () => {
  it('zero page views in the window → null (NOT 0, NOT NaN, NOT Infinity)', () => {
    const conversion = refConversion(3, 0);
    expect(conversion).toBeNull();
    expect(conversion).not.toBe(0);
    expect(Number.isNaN(conversion as unknown as number)).toBe(false);
  });

  it('non-zero views → a finite ratio in [0, 1] for messages ≤ views', () => {
    const conversion = refConversion(4, 200);
    expect(conversion).not.toBeNull();
    expect(conversion as number).toBeCloseTo(0.02, 5);
    expect(Number.isFinite(conversion as number)).toBe(true);
  });
});

// RED until Plan 33-04 extends `getOwnerAnalytics` with the ANLY-06 conversion +
// outbound-click aggregation. Skipped so the not-yet-existing exports are not
// evaluated on every run; flip to `describe(` (drop `.skip`) when 33-04 lands.
describe.skip('ANLY-06 — getOwnerAnalytics conversion + click aggregation (RED until 33-04)', () => {
  it('exposes a conversion30d helper/field that returns null on zero views', async () => {
    const mod = (await import(/* @vite-ignore */ ANALYTICS_MOD)) as {
      computeConversion?: (messages: number, views: number) => number | null;
    };
    expect(typeof mod.computeConversion).toBe('function');
    expect(mod.computeConversion!(5, 0)).toBeNull();
  });

  it.todo('clicks30d counts analytics_events rows in the 30-day window');
  it.todo('topDestinations groups by derived category (social/contact/project/other) desc');
});
