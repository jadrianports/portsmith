/**
 * RED (Wave 0, 13.2-01) — SC-1 / SC-2 · D-03 + D-04: the post write Zod gate.
 *
 * Layer 1 of the two-layer Markdown safety model (the render-time sanitize in
 * sanitize.test.ts is layer 2). The post write schema must enforce modest hard caps
 * so a write can never store an oversized or malformed Markdown post:
 *
 *   D-03  body Markdown ≤ 64 KB (65536 bytes); tags ≤ 6; bounded title/slug — the
 *         same posture as `blogPreviewPostItemSchema` (sections.ts:204-213).
 *   D-04  slug charset is strict lowercase/digits/hyphens (`^[a-z0-9-]+$`), bounded;
 *         `Bad Slug!` (uppercase + space + `!`) is rejected, `good-slug-1` accepted.
 *
 * The schema under test is `postContentSchema` — the NEW Markdown post schema authored
 * in a later plan (RESEARCH § Validation Architecture → posts.ts, exported via the
 * `@/lib/validations` barrel). The EXISTING `blogSchema` (blog.ts) is the OLD Tiptap-
 * JSON shape (body = a `{ type: "doc" }` object, tags ≤ 10, slug ≤ 200, NO body-size
 * cap) and is NOT the target here — it predates the Markdown pivot (D-08).
 *
 * RED today: `postContentSchema` is not yet exported from `@/lib/validations`, so the
 * import binding is `undefined` and every `.parse`/`.safeParse` call throws. That IS
 * the RED state. Greened when the schema + barrel export exist.
 */
import { describe, expect, it } from 'vitest';

// The Markdown post write schema, barrel-exported from @/lib/validations (13.2-02).
import { postContentSchema } from '@/lib/validations';

/** A syntactically valid base post; individual tests override one field to probe a bound. */
const basePost = {
  title: 'A Perfectly Reasonable Post Title',
  slug: 'good-slug-1',
  body_md: '# Hello\n\nA short body.',
  tags: ['one', 'two', 'three'],
};

describe('SC-1 / D-03 — post body Markdown cap (≤ 64 KB)', () => {
  it('rejects a 65537-char body (one over the 64 KB / 65536 cap)', () => {
    const result = postContentSchema.safeParse({ ...basePost, body_md: 'x'.repeat(65537) });
    expect(result.success).toBe(false);
  });

  it('accepts a 64 KB (65536-char) body — the boundary value', () => {
    const result = postContentSchema.safeParse({ ...basePost, body_md: 'x'.repeat(65536) });
    expect(result.success).toBe(true);
  });
});

describe('SC-1 / D-03 — tags cap (≤ 6)', () => {
  it('rejects 7 tags (one over the cap)', () => {
    const tags = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const result = postContentSchema.safeParse({ ...basePost, tags });
    expect(result.success).toBe(false);
  });

  it('accepts 6 tags — the boundary value', () => {
    const tags = ['a', 'b', 'c', 'd', 'e', 'f'];
    const result = postContentSchema.safeParse({ ...basePost, tags });
    expect(result.success).toBe(true);
  });
});

describe('SC-1 / D-04 — slug charset (^[a-z0-9-]+$)', () => {
  it('rejects "Bad Slug!" (uppercase + space + punctuation)', () => {
    const result = postContentSchema.safeParse({ ...basePost, slug: 'Bad Slug!' });
    expect(result.success).toBe(false);
  });

  it('accepts "good-slug-1" (lowercase, digits, hyphens)', () => {
    const result = postContentSchema.safeParse({ ...basePost, slug: 'good-slug-1' });
    expect(result.success).toBe(true);
  });
});
