/**
 * RED (Wave 0, 13.2-01) — SC-3 / D-14 + D-15: the dedicated-sub-page gate lives on the
 * template spec (`spec.pages`), and defaults to NONE.
 *
 * `/services` and the blog sub-routes are dedicated-page renders gated PER TEMPLATE by
 * a new `pages` member on the template spec (D-14: edgerunner-v2 opts into dedicated
 * sub-pages; D-15: a template that does not declare `pages` renders none). The gate is:
 *   - `resolveSpec('edgerunner-v2').pages` includes `'blog'` AND `'services'`;
 *   - `resolveSpec('minimal').pages` is undefined / does NOT include `'blog'` (a
 *     template defaults to NO dedicated sub-pages — the safe degrade).
 *
 * Lives under tests/integration (not tests/unit) alongside the other template-spec
 * gates; it imports `resolveSpec` from the registry (no DB I/O of its own, but it
 * shares the integration project's node env + sequential run). Does NOT call
 * `supabase db reset`.
 *
 * `pages` is NOT yet a member of the `TemplateSpec` type, and neither spec declares it
 * — so `resolveSpec(...).pages` is `undefined` at runtime today. We read it through a
 * narrow typed view (`PagesView`) so tsc stays clean while the runtime assertion fails
 * RED. Greened when `TemplateSpec.pages` + the per-template `pages` arrays exist.
 */
import { describe, expect, it } from 'vitest';

import { resolveSpec } from '@/components/templates/registry';

/** The not-yet-existing `pages` member, read through a narrow view to keep tsc clean. */
type PagesView = { pages?: readonly string[] };

function pagesOf(slug: string): readonly string[] | undefined {
  return (resolveSpec(slug) as unknown as PagesView).pages;
}

describe('SC-3 / D-14 — edgerunner-v2 opts into the blog + services dedicated pages', () => {
  it("resolveSpec('edgerunner-v2').pages includes 'blog' and 'services'", () => {
    const pages = pagesOf('edgerunner-v2');
    expect(pages).toContain('blog');
    expect(pages).toContain('services');
  });
});

describe('SC-3 / D-15 — a template defaults to NO dedicated sub-pages', () => {
  it("resolveSpec('minimal').pages does not include 'blog' (undefined / empty)", () => {
    const pages = pagesOf('minimal');
    expect(pages ?? []).not.toContain('blog');
  });
});
