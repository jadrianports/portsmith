/**
 * SHARE-01 / D-01 / D-02 — the per-portfolio share-card accent map.
 *
 * The dynamic Open Graph card (Plan 02) is ONE art-directed renderer tinted per portfolio
 * via this static `slug→accent` map, which MIRRORS `TEMPLATE_UUIDS`
 * (`src/components/templates/registry.ts`). The accent hex is the SINGLE per-portfolio
 * variable the card pulls from the template world (D-01) — so each card feels personal while
 * there is exactly one generator to maintain and every future template gets a good card for
 * free. A unit test asserts this map's key set equals `templateRegistry`'s, so a new template
 * can never silently lose its card tint.
 *
 * D-02: the card is a THIRD surface (like `og-default.png`) with its own art direction. It does
 * NOT consume platform chrome tokens (Evergreen/Copper) or a template's scoped `.tmpl-*` theme —
 * it reaches into the template world for THIS ONE thing only (the accent). This module therefore
 * lives in `src/lib/og/`, NOT in `registry.ts` / `template-meta.ts`, keeping the card's third
 * surface isolated and off any client bundle. It touches no secret, so it needs no
 * `import 'server-only'` — Plan 02's server-side OG route imports it freely.
 *
 * VALUES are each live template's primary `--accent` token, resolved to a STATIC hex.
 * Satori (inside `next/og`'s `ImageResponse`) CANNOT parse `oklch` (RESEARCH Pitfall 4), so
 * edgerunner-v2's authored `var(--neon-pink)` = `oklch(0.72 0.30 350)` is stored pre-resolved as
 * `#ff2d95`. (PATTERNS.md correction: minimal DOES have a scoped accent `#ff2d95` — RESEARCH's
 * `#111827` was wrong.)
 */

/**
 * Slug → resolved accent hex. MIRRORS `TEMPLATE_UUIDS` keys exactly (D-01).
 * Sources (each template's scoped `theme.css` `--accent`, default/primary mode):
 *   minimal       theme.css:44  `#ff2d95` (hot magenta)
 *   editorial     theme.css:67  `#c8381f` (vermilion)
 *   aurora        theme.css:62  `#d6336c` (rose-magenta)
 *   edgerunner-v2 theme.css:66→26 `var(--neon-pink)` = `oklch(0.72 0.30 350)` → resolved `#ff2d95`
 *   atelier       theme.css:45  `#c8ff00` (acid green)
 */
export const SLUG_ACCENT: Record<string, string> = {
  minimal: '#ff2d95',
  editorial: '#c8381f',
  aurora: '#d6336c',
  'edgerunner-v2': '#ff2d95',
  atelier: '#c8ff00',
  blueprint: '#2563eb', // blueprint blue (theme.css --accent)
};

/**
 * The accent for an unknown/null slug. Chosen as the brand-leaning hot magenta `#ff2d95`
 * (the synthwave accent the founder's dogfood card reads) so an unmapped slug still tints a
 * good-looking card rather than going blank. The UI-phase may retune this to a brand-neutral.
 */
export const DEFAULT_ACCENT = '#ff2d95';

/**
 * Resolve a template slug to its card accent, safe-degrading to {@link DEFAULT_ACCENT} for a
 * null/undefined/unknown slug — mirrors `slugForTemplateId`'s `(key && MAP[key]) || DEFAULT`
 * idiom so the card render is zero-DB, SSG-safe, and NEVER returns `undefined`.
 */
export function accentForSlug(slug: string | null | undefined): string {
  return (slug && SLUG_ACCENT[slug]) || DEFAULT_ACCENT;
}
