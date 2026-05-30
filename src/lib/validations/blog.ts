/**
 * Blog post validation (FND-04).
 *
 * Authored NOW per CONTEXT D-04 (the gate must be stable before anything writes),
 * even though the blog feature ships in Phase 2. Mirrors `blog_posts` (docs/01)
 * and the docs/04 contract:
 *   - `title` 1–200
 *   - `slug`  1–200, `^[a-z0-9-]+$`
 *   - `body`  a Tiptap JSON document — a non-empty object with `type: "doc"`
 *             (JSONB, NOT HTML — ADR-009). We validate the document root is
 *             `{ type: "doc", ... }` and otherwise pass the structure through;
 *             deep Tiptap-node validation is the editor's concern, not this
 *             storage gate.
 *             NOTE (WR-07): this root-type check is NOT an XSS guarantee. The
 *             stored JSON is only safe to render once the Phase-2 SERVER renderer
 *             sanitizes it — see the TODO on `blogBodySchema` below.
 *   - `tags`  max 10, optional
 */
import { z } from 'zod';

export const BLOG_SLUG_REGEX = /^[a-z0-9-]+$/;

/**
 * Tiptap document body: must be an object whose `type` is the literal `"doc"`.
 * `passthrough()` keeps the rest of the document (the `content` node array, marks,
 * attrs) intact without enumerating every Tiptap node type here.
 *
 * WR-07 — THIS GATE IS SHALLOW AND IS NOT AN XSS GUARANTEE. It asserts only the
 * document root shape; arbitrary node types, marks, and attributes (including
 * attacker-controlled `href` / `src`) pass through unvalidated. This is
 * acceptable ONLY because blog is a Phase-2 feature and nothing renders this body
 * yet.
 *
 * TODO (Phase 2, BLOCKING before any blog body is rendered): the server-side
 * Tiptap renderer MUST sanitize and constrain this content — allowlist the
 * permitted node/mark types, and sanitize link/image attributes (constrain
 * `href`/`src` to safe schemes: http/https/mailto; strip `javascript:` and
 * `data:` URLs). Do NOT assume this storage schema makes the body XSS-safe; the
 * safety lives in the (not-yet-written) renderer, and a tightened body schema
 * here would be even better. Add a renderer sanitization test alongside it.
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
