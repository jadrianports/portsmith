/**
 * Template CHROME metadata — the RUNTIME-LIGHT, zod-free, `next/dynamic`-free half of
 * the registry (the slug→display-copy lookup the Surface-B switcher renders).
 *
 * WHY THIS IS A SEPARATE MODULE (07-06 bundle gate, D-25):
 * `registry.ts` evaluates `templateSlugSchema = z.enum(...)` at module scope (it
 * `import { z } from 'zod'`) and builds the `next/dynamic` template map. So importing
 * ANY symbol from `registry.ts` into a CLIENT component pulls zod (+ dynamic) into that
 * component's client chunk. The `template-mismatch-warning` island is reachable from the
 * public `/[username]` route (via the draft-mode `PreviewBanner`), so its
 * `resolveTemplateMeta` import was dragging ~63 kB gz of zod onto the public First Load
 * JS and breaching the ≤200 kB budget. The chrome metadata needs NONE of that, so it
 * lives here — a pure data + pure functions module that imports nothing heavy. Client
 * chrome imports from HERE; `registry.ts` re-exports these for server consumers.
 *
 * zod stays the SERVER-side validation gate (in `registry.ts` + `@/lib/validations`),
 * untouched — this only changes WHERE the client reads display copy from.
 */

/**
 * Per-template CHROME presentation metadata for the Surface-B switcher (07-05): the
 * human-readable name, a short description, and the REQUIRED descriptive alt for the
 * static thumbnail (D-P7-07 — never empty, never "thumbnail"). This is CHROME copy (the
 * picker is platform chrome) — NOT a template token, no `.tmpl-*` styling. `minimal` is
 * a normal equal option with NO "Founder"/"exclusive" label (D-P7-14).
 */
export interface TemplateMeta {
  /** The display name shown on the card + in the confirm/preview copy ("Minimal"). */
  name: string;
  /** A short, plain-language description (Caption/Body, muted) under the name. */
  description: string;
  /** The REQUIRED <img> alt for `public/templates/<slug>.webp` (D-P7-07). */
  thumbnailAlt: string;
}

/**
 * The slug-keyed display metadata. `minimal` and `editorial` only in v1 — both equal
 * peers (D-P7-14); the differentiator is the runtime "● Current" marker, NOT the copy.
 * A new template adds its display copy HERE and its `dynamic()` line in `registry.ts`
 * (registry.ts asserts the two key sets match so they cannot drift).
 */
export const templateMeta: Record<string, TemplateMeta> = {
  minimal: {
    name: 'Minimal',
    description: 'A bold, dark single-scroll with neon accents.',
    thumbnailAlt:
      'Minimal template preview — dark synthwave background with neon magenta and cyan accents',
  },
  editorial: {
    name: 'Editorial',
    description: 'A light, editorial layout with a serif headline and ruled sections.',
    thumbnailAlt:
      'Editorial template preview — light ivory canvas, large serif headline, ruled sections',
  },
};

/**
 * Resolve a slug to its display metadata, falling back to a humanized form of the slug
 * for an unknown one (the safe degrade — never `undefined` into the UI). Used by the
 * template picker/card + the PreviewBanner confirm copy.
 */
export function resolveTemplateMeta(slug: string): TemplateMeta {
  return (
    templateMeta[slug] ?? {
      name: slug.charAt(0).toUpperCase() + slug.slice(1),
      description: '',
      thumbnailAlt: `${slug} template preview`,
    }
  );
}

/**
 * The ordered list of switchable templates for the picker gallery — `[slug, meta]`
 * pairs derived from `templateMeta` keys (so a 3rd template auto-appears once its copy
 * is added). Each is an EQUAL option (D-P7-14); the gallery marks the current one at
 * render time.
 */
export function listTemplates(): { slug: string; meta: TemplateMeta }[] {
  return Object.keys(templateMeta).map((slug) => ({
    slug,
    meta: resolveTemplateMeta(slug),
  }));
}
