/**
 * Unit coverage for the render-time href guard `safeHref` (CR-01, 03-REVIEW).
 *
 * `safeHref` is defense-in-depth layer 2 behind the http(s) Zod gate: every
 * template link renderer routes its URL through it so a dangerous-scheme href is
 * dropped at render time regardless of how it reached the component. These tests
 * pin the exact contract the hero CTA / résumé button, project links, footer
 * socials, and the contact mailto rely on.
 */
import { describe, expect, it } from 'vitest';

import { safeHref } from '@/lib/safe-url';

describe('safeHref (CR-01 render guard)', () => {
  it('DROPS a javascript: URL (returns undefined → caller omits the link)', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('JavaScript:alert(1)')).toBeUndefined(); // case-insensitive scheme
  });

  it('DROPS data: / vbscript: / file: and protocol-relative URLs', () => {
    expect(safeHref('data:text/html;base64,PHNjcmlwdD4=')).toBeUndefined();
    expect(safeHref('vbscript:msgbox(1)')).toBeUndefined();
    expect(safeHref('file:///etc/passwd')).toBeUndefined();
    expect(safeHref('//evil.com/x')).toBeUndefined(); // protocol-relative → arbitrary origin
  });

  it('KEEPS an https URL unchanged', () => {
    expect(safeHref('https://example.com/cv.pdf')).toBe('https://example.com/cv.pdf');
  });

  it('KEEPS an http URL unchanged', () => {
    expect(safeHref('http://example.com/p')).toBe('http://example.com/p');
  });

  it('KEEPS an in-page anchor (#contact) — the hero CTA default', () => {
    expect(safeHref('#contact')).toBe('#contact');
    expect(safeHref('#projects')).toBe('#projects');
  });

  it('KEEPS a root-relative path (/path)', () => {
    expect(safeHref('/jadrianports')).toBe('/jadrianports');
    expect(safeHref('/foo/bar')).toBe('/foo/bar');
  });

  it('DROPS mailto: by default but KEEPS it with { allowMailto: true } (contact only)', () => {
    expect(safeHref('mailto:hello@example.com')).toBeUndefined();
    expect(safeHref('mailto:hello@example.com', { allowMailto: true })).toBe(
      'mailto:hello@example.com',
    );
    // allowMailto does NOT widen to other dangerous schemes.
    expect(safeHref('javascript:alert(1)', { allowMailto: true })).toBeUndefined();
  });

  it('DROPS nullish / empty / whitespace-only input', () => {
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref('')).toBeUndefined();
    expect(safeHref('   ')).toBeUndefined();
  });

  it('DROPS unparseable junk', () => {
    expect(safeHref('not a url')).toBeUndefined();
  });
});
