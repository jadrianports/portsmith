/**
 * Blog post write-validation (SC-1 · D-03 / D-04) — the Markdown post write gate.
 *
 * Posts are first-class `blog_posts` rows (D-01), NOT schemaless section JSONB, so
 * this is a dedicated schema rather than an entry in `sectionContentSchemas`. It is
 * Layer 1 of the two-layer Markdown safety model — the render-time sanitize
 * (react-markdown `skipHtml` + `urlTransform`) is Layer 2. A write can never store
 * an oversized or malformed Markdown post once this gate passes.
 *
 * This is the NEW Markdown schema (`body_md` is a Markdown SOURCE string, D-08). It
 * REPLACES, for the write path, the legacy `blogSchema` (`./blog`) which models the
 * old Tiptap-JSON `body` object (ADR-009, reversed in migration 017). `./blog` is
 * left untouched; new call sites import `postContentSchema` from `@/lib/validations`.
 *
 * Zod 4 (4.4.3) idiom — TOP-LEVEL formats only, unified `{ error }` param. NEVER
 * `z.string().email()` / `.url()` (deprecated + forbidden by CLAUDE.md).
 *
 * Caps (D-03 / D-04), mirroring `blogPreviewPostItemSchema` bounds (sections.ts:204):
 *   D-03  body_md ≤ 64 KB (65536 chars); tags ≤ 6; bounded title / excerpt.
 *   D-04  slug charset is strict lowercase / digits / single-hyphen-separated,
 *         bounded — blocks path-injection-shaped slugs (`Bad Slug!` rejected).
 *
 * NOTE — the ~50-posts-per-portfolio cap (D-03) is NOT a per-post field constraint;
 * it is enforced in the create action as a count check (a row-count guard cannot be
 * expressed in this single-post schema). Documented here so the action author knows
 * this schema deliberately omits it.
 */
import { z } from 'zod';

/**
 * One post write. `published` is the lifecycle flag — set ONLY by the explicit
 * publish/unpublish action, never by content auto-save (D-02 / D-20: draft by
 * default means an auto-save can never push a post live).
 */
export const postContentSchema = z.object({
  title: z.string().trim().min(1).max(150),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      error: 'lowercase letters, digits, and single hyphens only',
    }),
  // D-03: ~64 KB Markdown source cap. Measured in characters (the test boundary is
  // 65536 chars OK, 65537 rejected).
  body_md: z.string().max(65536, { error: 'Post is too long (64 KB max)' }),
  excerpt: z.string().trim().max(500).optional(),
  // D-05: editable ISO date string; mirrors the experience-date idiom (bounded text).
  display_date: z.string().trim().max(40).optional(),
  // D-06: up to 6 tags, each a bounded non-empty string.
  tags: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
  // D-02 / D-20: lifecycle flag, set by the publish action only.
  published: z.boolean().optional(),
});

/** The inferred post write type (write path uses this, reads use the generated `Database` type). */
export type PostContent = z.infer<typeof postContentSchema>;
