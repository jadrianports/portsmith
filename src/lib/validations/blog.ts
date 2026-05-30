/**
 * Blog post validation (FND-04).
 *
 * Authored NOW per CONTEXT D-04 (the gate must be stable before anything writes),
 * even though the blog feature ships in Phase 2. Mirrors `blog_posts` (docs/01)
 * and the docs/04 contract:
 *   - `title` 1–200
 *   - `slug`  1–200, `^[a-z0-9-]+$`
 *   - `body`  a Tiptap JSON document — a non-empty object with `type: "doc"`
 *             (JSONB, NOT HTML; rendered server-side, XSS-safe by construction —
 *             ADR-009). We validate the document root is `{ type: "doc", ... }`
 *             and otherwise pass the structure through; deep Tiptap-node
 *             validation is the editor's concern, not the storage gate.
 *   - `tags`  max 10, optional
 */
import { z } from 'zod';

export const BLOG_SLUG_REGEX = /^[a-z0-9-]+$/;

/**
 * Tiptap document body: must be an object whose `type` is the literal `"doc"`.
 * `passthrough()` keeps the rest of the document (the `content` node array, marks,
 * attrs) intact without enumerating every Tiptap node type here.
 */
export const blogBodySchema = z
  .object({
    type: z.literal('doc'),
  })
  .passthrough();

export const blogSchema = z.object({
  title: z
    .string()
    .min(1, { error: 'Title is required' })
    .max(200, { error: 'Title must be at most 200 characters' }),
  slug: z
    .string()
    .min(1, { error: 'Slug is required' })
    .max(200, { error: 'Slug must be at most 200 characters' })
    .regex(BLOG_SLUG_REGEX, { error: 'Slug must contain only lowercase letters, digits, or -' }),
  body: blogBodySchema,
  tags: z.array(z.string()).max(10, { error: 'At most 10 tags' }).optional(),
});

export type Blog = z.infer<typeof blogSchema>;
