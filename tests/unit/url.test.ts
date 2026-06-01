/**
 * Unit coverage for the absolute-URL helper (PUB-03 / D-22).
 *
 * `siteOrigin()` / `siteUrl()` are pure functions of `NEXT_PUBLIC_SITE_URL`, so the
 * tests mutate that env var (saved/restored around each case) and assert the
 * normalization edge cases the downstream canonical/footer/sitemap depend on:
 *   - a normal origin
 *   - a trailing-slash origin (no double slash)
 *   - a path missing its leading slash
 *   - the missing-env fallback to localhost
 *   - the no-arg root case
 *
 * SECURITY: the helper must NEVER read `headers()` / the request host (T-03-02);
 * a static-source check in this file asserts that invariant directly.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { siteOrigin, siteUrl } from '@/lib/url';

describe('siteOrigin / siteUrl (PUB-03)', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = saved;
    }
  });

  it('siteOrigin returns the configured origin', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://portsmith.app';
    expect(siteOrigin()).toBe('https://portsmith.app');
  });

  it('siteOrigin strips trailing slash(es)', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://portsmith.app/';
    expect(siteOrigin()).toBe('https://portsmith.app');
    process.env.NEXT_PUBLIC_SITE_URL = 'https://portsmith.app///';
    expect(siteOrigin()).toBe('https://portsmith.app');
  });

  it('siteOrigin falls back to localhost when NEXT_PUBLIC_SITE_URL is unset', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteOrigin()).toBe('http://localhost:3000');
  });

  it('siteOrigin falls back to localhost when NEXT_PUBLIC_SITE_URL is blank/whitespace', () => {
    process.env.NEXT_PUBLIC_SITE_URL = '   ';
    expect(siteOrigin()).toBe('http://localhost:3000');
  });

  it('siteUrl returns origin + path for a leading-slash path', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://portsmith.app';
    expect(siteUrl('/jadrianports')).toBe('https://portsmith.app/jadrianports');
  });

  it('siteUrl adds a missing leading slash', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://portsmith.app';
    expect(siteUrl('jadrianports')).toBe('https://portsmith.app/jadrianports');
  });

  it('siteUrl with no arg returns the origin root', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://portsmith.app';
    expect(siteUrl()).toBe('https://portsmith.app/');
  });

  it('a trailing-slash origin never yields a double slash', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://portsmith.app/';
    expect(siteUrl('/x')).toBe('https://portsmith.app/x');
  });

  it('siteUrl uses the localhost fallback when env is unset', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl('/jadrianports')).toBe('http://localhost:3000/jadrianports');
  });
});

describe('siteUrl source invariant (T-03-02)', () => {
  it('never reads headers() or the request host', () => {
    const src = readFileSync(fileURLToPath(new URL('../../src/lib/url.ts', import.meta.url)), 'utf8');
    // Strip line comments so the prose in the file header (which mentions headers()
    // as the thing we DON'T do) cannot trip the assertion.
    const code = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    expect(code).not.toMatch(/headers\s*\(/);
    expect(code).not.toMatch(/\bhost\b/i);
  });
});
