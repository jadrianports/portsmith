/**
 * Unit coverage for the read-time source-bucket mapping (ANLY-02 / D-10 / D-18).
 *
 * `toSourceBucket(referrerHost, utmSource, utmMedium)` produces the friendly source
 * labels the owner card + operator Insights render ("LinkedIn 40 · Google 12 ·
 * Indeed 8 · Direct 30"). These tests PASS NOW — the utility ships in Plan 15-01
 * (Task 1). They pin the locked D-10 precedence: UTM WINS when present, else the
 * referrer host maps via the substring table, else the explicit "Direct / unknown"
 * fallback.
 *
 * Pure node-env test (no DOM, no I/O) — the vitest `unit` project (`node`).
 */
import { describe, expect, it } from 'vitest';

import { DIRECT_BUCKET, toSourceBucket } from '@/lib/analytics/source-buckets';

describe('toSourceBucket — UTM wins when present (D-10)', () => {
  it('returns a UTM-derived label over the referrer host', () => {
    // host says linkedin, but a UTM source is present → UTM wins (NOT the host map).
    const bucket = toSourceBucket('linkedin.com', 'newsletter', 'email');
    expect(bucket).toBe('Newsletter'); // friendly-cased free-form UTM source
    expect(bucket).not.toBe('LinkedIn'); // the host did NOT win
  });

  it('maps a known UTM source token to its branded label', () => {
    expect(toSourceBucket(null, 'google', 'cpc')).toBe('Google');
    expect(toSourceBucket('t.co', 'linkedin', 'social')).toBe('LinkedIn');
  });

  it('ignores a blank/whitespace UTM source and falls through to the host', () => {
    expect(toSourceBucket('www.google.com', '   ', null)).toBe('Google');
    expect(toSourceBucket('www.google.com', '', null)).toBe('Google');
  });
});

describe('toSourceBucket — referrer-host mapping (D-10)', () => {
  it('maps LinkedIn / Google / Indeed hosts to friendly labels', () => {
    expect(toSourceBucket('www.linkedin.com', null, null)).toBe('LinkedIn');
    expect(toSourceBucket('www.google.com', null, null)).toBe('Google');
    expect(toSourceBucket('www.indeed.com', null, null)).toBe('Indeed');
  });

  it('maps the Twitter/X family (t.co, twitter.com, x.com) to one bucket', () => {
    expect(toSourceBucket('t.co', null, null)).toBe('Twitter/X');
    expect(toSourceBucket('twitter.com', null, null)).toBe('Twitter/X');
    expect(toSourceBucket('x.com', null, null)).toBe('Twitter/X');
  });

  it('maps Facebook and Reddit hosts', () => {
    expect(toSourceBucket('www.facebook.com', null, null)).toBe('Facebook');
    expect(toSourceBucket('m.fb.com', null, null)).toBe('Facebook');
    expect(toSourceBucket('www.reddit.com', null, null)).toBe('Reddit');
  });

  it('matches the host case-insensitively', () => {
    expect(toSourceBucket('WWW.LINKEDIN.COM', null, null)).toBe('LinkedIn');
  });
});

describe('toSourceBucket — Direct / unknown fallback (D-10)', () => {
  it('falls back to "Direct / unknown" for a null host and no UTM', () => {
    expect(toSourceBucket(null, null, null)).toBe(DIRECT_BUCKET);
    expect(DIRECT_BUCKET).toBe('Direct / unknown');
  });

  it('falls back for an unrecognized host', () => {
    expect(toSourceBucket('example.com', null, null)).toBe(DIRECT_BUCKET);
  });

  it('falls back for an empty-string host', () => {
    expect(toSourceBucket('', null, null)).toBe(DIRECT_BUCKET);
  });
});
