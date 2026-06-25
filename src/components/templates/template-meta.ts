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
 * picker is platform chrome) — NOT a template token, no `.tmpl-*` styling.
 *
 * This module stays ZOD-FREE and stores NO `restricted`/visibility flag (D-P12-09,
 * supersedes D-P7-14). The picker's "Exclusive" marker is driven by the RUNTIME
 * `restricted` flag from the allowed-list (`getAvailableTemplates()`), NOT static meta —
 * a stored flag would go stale the moment the operator flips a template's visibility in
 * /admin. So `TemplateMeta` carries display copy ONLY.
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
 * The slug-keyed display metadata. Display COPY only — no visibility/`restricted` flag
 * (D-P12-09, supersedes D-P7-14): the differentiators are the RUNTIME markers ("● Current"
 * from the owner's current slug, "Exclusive" from the allowed-list's `restricted` flag),
 * NOT the copy. A new template adds its display copy HERE and its `dynamic()` line in
 * `registry.ts` (registry.ts asserts the two key sets match so they cannot drift).
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
  aurora: {
    name: 'Aurora',
    description: 'A warm, rosy single-scroll with gradient accents and soft glass cards.',
    thumbnailAlt:
      'Aurora template preview — pale rose canvas with a gradient headline name and soft rounded cards',
  },
  edgerunner: {
    name: 'Edgerunner',
    description:
      'A dark synthwave single-scroll with neon accents, animated skill bars, and a live WebGL centerpiece.',
    thumbnailAlt:
      'Edgerunner template preview — dark synthwave canvas with neon magenta and cyan accents, a glowing WebGL shape, and animated skill bars',
  },
  'edgerunner-v2': {
    name: 'Edgerunner V2',
    description:
      'A faithful bar-for-bar transcription of the synthwave Lovable export with exact motion values, neon glow utilities, and animated hero.',
    thumbnailAlt:
      'Edgerunner V2 template preview — dark synthwave canvas with neon pink and cyan accents, animated city backdrop, and terminal HUD',
  },
  atelier: {
    name: 'Atelier',
    description:
      'A dark, image-first editorial single-scroll — a gallery wall, case studies, and oversized type with an acid-green accent.',
    thumbnailAlt:
      'Atelier template preview — near-black editorial canvas with a masonry gallery wall, oversized condensed uppercase type, and an acid-green accent',
  },
  blueprint: {
    name: 'Blueprint',
    description:
      'A dark "engineering bench" single-scroll — a blueprint-grid canvas, mono channel labels, PCB-trace dividers, and a single blueprint-blue accent. Includes a built-in blog.',
    thumbnailAlt:
      'Blueprint template preview — near-black GitHub-dark canvas with a faint blueprint grid, mono uppercase labels, and a single blueprint-blue accent',
  },
};

/**
 * One entry in the curated category GROUP order (TCAT-02, D-03). `key` is the soft-enum
 * `templates.category` value (`getAvailableTemplates()` → `AllowedTemplate.category`);
 * `label` is the plain-language group header the pickers render. CHROME display copy —
 * zod-free, registry-free (this module must NOT pull zod/`next/dynamic` onto a client
 * chunk — D-25), no `.tmpl-*` styling.
 */
export interface CategoryGroup {
  key: string;
  label: string;
}

/**
 * The FIXED curated group order the dashboard picker + onboarding gallery iterate (D-03):
 * Developer → Creative → Marketer → General, plus a reserved Video slot. There is NO
 * per-card category badge — the group HEADER names the category (D-03), so a chip would be
 * redundant in the grouped layout.
 *
 * The `video` slot is DEFINED here (its label reserved) but renders only when its category
 * is non-empty: Plan 02 filters groups by the ALLOWED-LIST, so `video` stays hidden until
 * a video-category template ships (SEED-001, next milestone) — exactly the mechanism that
 * keeps an empty group out of the UI.
 */
export const categoryGroups: CategoryGroup[] = [
  { key: 'dev', label: 'Developer' },
  { key: 'creative', label: 'Creative' },
  { key: 'marketer', label: 'Marketer' },
  { key: 'general', label: 'General' },
  { key: 'video', label: 'Video' },
];

/** Lookup map derived from the curated order — internal to `categoryLabel`. */
const categoryLabelByKey: Record<string, string> = Object.fromEntries(
  categoryGroups.map((g) => [g.key, g.label]),
);

/**
 * Resolve a category key to its plain-language label, degrading an unknown/null key to the
 * `general` label (belt-and-suspenders with the data-layer `'general'` fallback in
 * `getAvailableTemplates()`) — mirrors `resolveTemplateMeta`'s safe degrade so the UI never
 * sees a raw key or `undefined`.
 */
export function categoryLabel(category: string): string {
  return categoryLabelByKey[category] ?? categoryLabelByKey.general;
}

/**
 * One non-empty category group the pickers render: the curated `key`/`label` plus the
 * subset of allowed items that carry that `category`. Generic over the item shape so BOTH
 * the dashboard picker's inline `{ slug; restricted; category }` and the server
 * `AllowedTemplate` satisfy it WITHOUT a shared type import (preserving D-25 — no server
 * value-import dragged onto the client picker chunk).
 */
export interface AllowedCategoryGroup<T> {
  key: string;
  label: string;
  items: T[];
}

/**
 * Re-bucket the ALREADY-ALLOWED template set (`getAvailableTemplates()` →
 * `AllowedTemplate[]`, or the picker's inline allowed shape) into the curated category
 * order for grouped display (TCAT-02, D-01/D-03/D-04). The SINGLE new branch of the
 * phase lives here, once: a category is emitted ONLY when `items.length > 0`, so an empty
 * category (e.g. `video`, until its template ships) renders no header.
 *
 * PURE + zod-free + registry-free (this module must not pull zod/`next/dynamic` onto a
 * client chunk — D-25). It iterates the curated `categoryGroups` order and, for each,
 * takes the STABLE subset of `allowed` whose `category` matches — preserving the existing
 * public-first-then-granted within-group order. It re-buckets ONLY the array passed in;
 * it NEVER reads a full catalog, so it can never surface an un-allowed template (TCAT-03).
 *
 * NO-DROP INVARIANT (WR-02): an allowed item whose `category` matches NONE of the curated
 * keys (a typo like 'develper', or an unseeded-but-non-null soft-enum value) is swept into
 * the `general` group rather than silently dropped — total items in === total items out.
 * Orphans are APPENDED after `general`'s natively-categorized members (stable: natives
 * first, then orphans in input order); the `general` group is CREATED at its curated
 * position if it has zero natives but ≥1 orphan. The empty-category skip is UNCHANGED — a
 * curated key with zero natives AND zero orphans (e.g. `video`) still emits no group.
 */
export function groupAllowedByCategory<T extends { category: string }>(
  allowed: T[],
): AllowedCategoryGroup<T>[] {
  const known = new Set(categoryGroups.map((g) => g.key));
  // Allowed items whose category matches no curated key — to be swept into `general`
  // (WR-02 no-drop), preserving input order.
  const orphans = allowed.filter((a) => !known.has(a.category));

  const groups: AllowedCategoryGroup<T>[] = [];
  for (const { key } of categoryGroups) {
    const items = allowed.filter((a) => a.category === key);
    // Fold orphans into `general`: append after its native members (creating the group
    // even when it has zero natives but ≥1 orphan).
    if (key === 'general' && orphans.length > 0) {
      items.push(...orphans);
    }
    if (items.length > 0) {
      groups.push({ key, label: categoryLabel(key), items });
    }
  }
  return groups;
}

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
 * The ordered list of every template's display copy — `[slug, meta]` pairs derived from
 * `templateMeta` keys. NOTE (12-04 / GATE-02): the picker gallery NO LONGER sources from
 * here — it renders one card per ALLOWED slug from the data-layer allowed-list
 * (`getAvailableTemplates()` → the `allowed` prop), looking up copy via
 * `resolveTemplateMeta`. This helper remains for server-side / full-catalog consumers
 * (it lists ALL templates regardless of visibility, so it must NOT drive the picker).
 */
export function listTemplates(): { slug: string; meta: TemplateMeta }[] {
  return Object.keys(templateMeta).map((slug) => ({
    slug,
    meta: resolveTemplateMeta(slug),
  }));
}
