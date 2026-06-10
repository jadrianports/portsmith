/**
 * The SINGLE hardcoded corpus slug list for the render gates + operator scripts (WR-05).
 *
 * WHY HARDCODED (not `Object.keys(templateRegistry)`): the Playwright render specs collect
 * under a Node ESM runner that CANNOT resolve `registry.ts`'s `next/dynamic` import at
 * collection time, and the `.mjs` operator scripts likewise must not drag the Next/registry
 * module graph. So the slug set is a plain literal here — but a literal that DRIFTS from the
 * registry silently drops a Phase-11 template from the a11y / parity / thumbnail / preview
 * surfaces. The anchor guard `tests/unit/templates/slugs-anchor.test.ts` (which CAN import the
 * registry under Vitest) asserts THIS constant equals `Object.keys(templateRegistry)`, so a
 * Phase-11 template addition fails LOUDLY here until the slug is added — the same anchor
 * pattern the negative controls use. Respects D-22: this is a TEST/SCRIPT helper, never
 * imported by a client/public bundle, so no `registry.ts` (zod) leaks onto `/[username]`.
 *
 * A Phase-11 template adds ONE line here (alongside its `registry.ts` line); every consumer
 * (a11y spec, parity spec, thumbnail generator, preview command) and the anchor guard pick it
 * up from this one place.
 */
export const TEMPLATE_SLUGS = ['minimal', 'editorial', 'aurora', 'edgerunner-v2'] as const;

export type TemplateSlug = (typeof TEMPLATE_SLUGS)[number];
