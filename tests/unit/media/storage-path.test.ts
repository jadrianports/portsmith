/**
 * Unit coverage for the URL ↔ Storage-path helpers (T-05-02 + Pitfall 5).
 *
 * `urlToStoragePath` is origin-locked to `NEXT_PUBLIC_SUPABASE_URL`: a Storage URL
 * parses to `{ bucket, path }`; a foreign-origin, non-public, or garbage URL
 * returns `null` (so the delete helper never targets a non-Storage object).
 * `buildObjectPath` always puts the verified sub as the FIRST segment.
 *
 * Mirrors the URL accept/reject idiom of `tests/unit/safe-image.test.ts`.
 * `NEXT_PUBLIC_SUPABASE_URL` is provided by vitest's dotenv load of `.env.local`.
 */
import { describe, expect, it } from 'vitest';

import { buildObjectPath, urlToStoragePath } from '@/lib/media/storage-path';

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;

describe('urlToStoragePath — origin-locked parse', () => {
  it('parses a public avatar URL to { bucket, path }', () => {
    const url = `${BASE}/storage/v1/object/public/avatars/uid/avatar/x.webp`;
    expect(urlToStoragePath(url)).toEqual({
      bucket: 'avatars',
      path: 'uid/avatar/x.webp',
    });
  });

  it('parses a media bucket URL', () => {
    const url = `${BASE}/storage/v1/object/public/media/uid/project/abc.webp`;
    expect(urlToStoragePath(url)).toEqual({
      bucket: 'media',
      path: 'uid/project/abc.webp',
    });
  });

  it('decodes percent-encoded path segments', () => {
    const url = `${BASE}/storage/v1/object/public/resumes/uid/resume/my%20cv.pdf`;
    expect(urlToStoragePath(url)).toEqual({
      bucket: 'resumes',
      path: 'uid/resume/my cv.pdf',
    });
  });

  it('returns null for a FOREIGN origin (host-lock, D-08)', () => {
    expect(
      urlToStoragePath('https://evil.com/storage/v1/object/public/media/x.webp'),
    ).toBeNull();
  });

  it('returns null for a non-public path on the Storage origin', () => {
    expect(urlToStoragePath(`${BASE}/storage/v1/object/sign/media/x.webp`)).toBeNull();
  });

  it('returns null when the public prefix has no bucket/path separator', () => {
    expect(urlToStoragePath(`${BASE}/storage/v1/object/public/onlybucket`)).toBeNull();
  });

  it('returns null for a garbage / unparseable string', () => {
    expect(urlToStoragePath('not a url')).toBeNull();
    expect(urlToStoragePath('')).toBeNull();
  });
});

describe('buildObjectPath — verified-sub first segment', () => {
  it('builds {sub}/{context}/{id}.{ext} with sub as the first segment', () => {
    const p = buildObjectPath('user-123', 'avatar', 'webp');
    const parts = p.split('/');
    expect(parts[0]).toBe('user-123');
    expect(parts[1]).toBe('avatar');
    expect(parts[2]).toMatch(/^[A-Za-z0-9_-]+\.webp$/);
  });

  it('mints a fresh id per call (no collision on replace)', () => {
    expect(buildObjectPath('u', 'project', 'webp')).not.toBe(
      buildObjectPath('u', 'project', 'webp'),
    );
  });
});
