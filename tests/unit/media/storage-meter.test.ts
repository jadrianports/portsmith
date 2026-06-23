/**
 * Unit coverage for the pure StorageMeter math (D-09 / B-10 / B-11).
 *
 * The StorageMeter component (`storage-meter.tsx`) is display-only React, but its
 * decision math — the fill ratio against `QUOTA_BYTES`, the three threshold STATES
 * (under <85% / approaching 85–<100% / at-over ≥100%, B-10), and the truthful
 * "X / 25 MB" readout — is lifted into a pure helper so the boundaries are testable
 * without a DOM (the vitest `unit` project is `node`, not jsdom).
 *
 * GREENED BY: Plan 05 Task 1 (the helper + the component that renders it). RED now
 * because `meterState` / `meterFillRatio` / `formatStorageReadout` do not yet exist.
 *
 * Mirrors the boundary-case idiom of `tests/unit/media/quota.test.ts` (exactly-at /
 * one-over) and the pure-helper home (`upload-config.ts`).
 */
import { describe, expect, it } from 'vitest';

import {
  formatStorageReadout,
  meterFillRatio,
  meterState,
  QUOTA_BYTES,
} from '@/lib/media/upload-config';

const MB = 1024 * 1024;

describe('meterState (B-10 thresholds — never accent, three states)', () => {
  it('is "under" on a fresh account and below 85%', () => {
    expect(meterState(0)).toBe('under');
    expect(meterState(1 * MB)).toBe('under');
    // Just below the 85% boundary.
    expect(meterState(Math.floor(QUOTA_BYTES * 0.85) - 1)).toBe('under');
  });

  it('is "approaching" from 85% up to (but not at) the cap', () => {
    expect(meterState(Math.ceil(QUOTA_BYTES * 0.85))).toBe('approaching');
    expect(meterState(QUOTA_BYTES - 1)).toBe('approaching');
  });

  it('is "over" exactly at the cap and beyond', () => {
    expect(meterState(QUOTA_BYTES)).toBe('over');
    expect(meterState(QUOTA_BYTES + 1)).toBe('over');
    expect(meterState(100 * MB)).toBe('over');
  });
});

describe('meterFillRatio (clamped 0..1)', () => {
  it('is 0 on a fresh account', () => {
    expect(meterFillRatio(0)).toBe(0);
  });

  it('is 0.5 at half the cap', () => {
    expect(meterFillRatio(QUOTA_BYTES / 2)).toBeCloseTo(0.5, 5);
  });

  it('is 1 exactly at the cap', () => {
    expect(meterFillRatio(QUOTA_BYTES)).toBe(1);
  });

  it('clamps over-cap usage to 1 (the fill never overflows the track)', () => {
    expect(meterFillRatio(QUOTA_BYTES * 2)).toBe(1);
  });

  it('clamps a negative/garbage value to 0', () => {
    expect(meterFillRatio(-100)).toBe(0);
  });
});

describe('formatStorageReadout ("X / 65 MB", truthful + tnum-ready)', () => {
  it('always ends in the 65 MB denominator (raised D-10 / MEDIA-01)', () => {
    expect(formatStorageReadout(0)).toMatch(/\/\s*65 MB$/);
    expect(formatStorageReadout(QUOTA_BYTES)).toMatch(/\/\s*65 MB$/);
  });

  it('renders whole-MB usage without a misleading 0', () => {
    expect(formatStorageReadout(12 * MB)).toBe('12 / 65 MB');
  });

  it('rounds sub-MB usage to one decimal so a tiny upload is not shown as 0', () => {
    // 512 KiB = 0.5 MB — must not read "0 / 65 MB".
    expect(formatStorageReadout(512 * 1024)).toBe('0.5 / 65 MB');
  });

  it('shows the cap figure at/over the cap', () => {
    expect(formatStorageReadout(QUOTA_BYTES)).toBe('65 / 65 MB');
  });
});
