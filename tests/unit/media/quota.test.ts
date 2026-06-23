/**
 * Unit coverage for the pure quota predicate (MEDIA-03 boundary math).
 *
 * `wouldExceedQuota(used, incoming)` is the server-authoritative pre-upload gate's
 * math, lifted out of the route so the exactly-at-cap / one-over / fresh-account
 * boundaries are testable without a request scope.
 *
 * Mirrors the boundary-case idiom of `tests/unit/validations.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import { QUOTA_BYTES, wouldExceedQuota } from '@/lib/media/upload-config';

describe('QUOTA_BYTES (D-09; raised D-10 / MEDIA-01)', () => {
  it('is exactly 65 MiB', () => {
    expect(QUOTA_BYTES).toBe(68_157_440);
  });
});

describe('wouldExceedQuota — pre-upload boundary', () => {
  it('allows a small upload on a fresh account (used = 0)', () => {
    expect(wouldExceedQuota(0, 1024)).toBe(false);
  });

  it('allows an upload that lands EXACTLY at the cap', () => {
    expect(wouldExceedQuota(QUOTA_BYTES - 1024, 1024)).toBe(false);
    expect(wouldExceedQuota(0, QUOTA_BYTES)).toBe(false);
  });

  it('rejects an upload that exceeds the cap by 1 byte', () => {
    expect(wouldExceedQuota(QUOTA_BYTES, 1)).toBe(true);
    expect(wouldExceedQuota(QUOTA_BYTES - 1023, 1024)).toBe(true);
  });

  it('rejects a large upload that blows past the cap', () => {
    // 60 + 10 = 70 MiB > the 65 MiB cap (D-10).
    expect(wouldExceedQuota(60 * 1024 * 1024, 10 * 1024 * 1024)).toBe(true);
  });
});
