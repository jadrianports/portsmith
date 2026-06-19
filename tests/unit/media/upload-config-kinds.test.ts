/**
 * META-03 / META-04 — the NEW `favicon` + `og` UploadKind specs (D-03 / D-05).
 *
 * Phase 29 adds two image upload slots as a PURE `upload-config.ts` config addition
 * (no migration — both ride the `media` bucket, gated unchanged by the BEFORE-INSERT
 * quota trigger; webp-only via the route's existing `isImageKind`/`ALLOWED_IMAGE_MIME`
 * path):
 *
 *   - `favicon` — a square (1:1) browser-tab icon at a 256×256 retina target.
 *   - `og`      — a 1.91:1 social-share card at the canonical 1200×630 target.
 *
 * Both live in the `media` bucket (so `kindToBucket.favicon === kindToBucket.og ===
 * 'media'`). This file pins the spec values so the producing config (Plan 02) is
 * unit-verified, and so a future drift (wrong aspect, wrong bucket) is caught.
 *
 * RED until Plan 02 adds the two kinds to `UPLOAD_KINDS` + `kindToBucket`. The
 * import-path + describe idiom mirrors the sibling `upload-content-length.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import { UPLOAD_KINDS, kindToBucket } from '@/lib/media/upload-config';

// The config table is typed `Record<UploadKind, …>`; until Plan 02 adds the kinds
// these lookups are `undefined` at runtime (and the union won't include them at the
// type level). Read through a loose view so the file compiles in the staged state.
const KINDS = UPLOAD_KINDS as Record<
  string,
  { bucket?: string; aspect?: number; target?: { width: number; height: number } }
>;
const BUCKET = kindToBucket as Record<string, string | undefined>;

describe('META-03 / D-03 — favicon UploadKind spec', () => {
  it('favicon is a 1:1 square at a 256×256 target in the media bucket', () => {
    const favicon = KINDS.favicon;
    expect(favicon).toBeDefined();
    expect(favicon.aspect).toBe(1);
    expect(favicon.bucket).toBe('media');
    expect(favicon.target).toEqual({ width: 256, height: 256 });
  });

  it('kindToBucket routes favicon to the media bucket (quota-trigger gated)', () => {
    expect(BUCKET.favicon).toBe('media');
  });
});

describe('META-04 / D-05 — og UploadKind spec', () => {
  it('og is a 1.91:1 card at the canonical 1200×630 target in the media bucket', () => {
    const og = KINDS.og;
    expect(og).toBeDefined();
    expect(og.aspect).toBe(1.91);
    expect(og.bucket).toBe('media');
    expect(og.target).toEqual({ width: 1200, height: 630 });
  });

  it('kindToBucket routes og to the media bucket (quota-trigger gated)', () => {
    expect(BUCKET.og).toBe('media');
  });
});
