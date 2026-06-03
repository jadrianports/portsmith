/**
 * filledVisibleSectionTypes — the shared "which section types are filled AND visible"
 * derivation that feeds the template-switch mismatch warning (TMPL-02 / D-P7-11).
 *
 * A PURE function over already-loaded section rows — NO Supabase, NO DB, NO client
 * (mirrors `@/lib/templates/mismatch.ts` + `@/lib/cms/completeness.ts` purity). It is
 * the UPSTREAM half of the mismatch check: `unsupportedFilledSections` answers "which
 * of these does the candidate template NOT render", and THIS answers "which types does
 * the user actually have content for and left visible" — the input to that predicate.
 *
 * It is consumed in TWO places that must agree byte-for-byte, so the predicate lives
 * here ONCE rather than being re-implemented:
 *   - the dashboard RSC (`(dashboard)/dashboard/page.tsx`) — to thread the filled types
 *     into `EditorShell` → the picker's MismatchWarning;
 *   - the public page DRAFT branch (`[username]/page.tsx`) — to thread them into the
 *     reused PreviewBanner's confirm-step MismatchWarning.
 *
 * The `hasContent` rule mirrors the editor's existing `hasContentFor` idiom
 * (`editor-shell.tsx`): item-bearing types need a non-empty `items[]`; `about` needs a
 * non-empty `bio`; `skills` needs a non-empty `groups[]`; everything else needs a
 * non-empty `heading`. Kept in lockstep with that idiom — a single source of truth for
 * "this section has real content."
 */

/** A loose record for reading schemaless section content (JSONB). */
type ContentRecord = Record<string, unknown>;

/**
 * The minimal section shape the derivation needs (a subset of `PublicSection`). The
 * fields are nullable because the `PublicSection` contract derives from the view Row
 * types where every column is nullable (STATE.md [03-01] — "consumers null-guard");
 * this helper does the guarding so callers can pass the loaded rows directly.
 */
export interface FilledSectionInput {
  type: string | null;
  /** The REAL visibility flag — a hidden (or null) section is never "filled-visible". */
  visible: boolean | null;
  /** Schemaless JSONB content (`Json`/`unknown`) — runtime-guarded to a record below. */
  content: unknown;
}

/** Item-bearing section types whose content lives in a `content.items[]` array. */
const ITEM_TYPES = new Set<string>(['projects', 'experience', 'testimonials']);

/**
 * Whether a section has real content yet — mirrors `editor-shell.tsx`'s `hasContentFor`
 * (the single source of truth for "this section is filled"). Item types need ≥1 item;
 * `about` needs a bio; `skills` needs ≥1 group; the rest need a non-empty heading.
 */
function hasContentFor(type: string, content: ContentRecord): boolean {
  if (ITEM_TYPES.has(type)) {
    return Array.isArray(content.items) && content.items.length > 0;
  }
  if (type === 'about') return typeof content.bio === 'string' && content.bio.trim().length > 0;
  if (type === 'skills') return Array.isArray(content.groups) && content.groups.length > 0;
  return typeof content.heading === 'string' && content.heading.trim().length > 0;
}

/**
 * The `section.type` for each row that has real content AND is visible — the input to
 * `unsupportedFilledSections(filledVisibleTypes, candidateSpec)`.
 *
 * @param sections - the loaded section rows (with their REAL `visible` flag + content).
 * @returns the de-duplicated list of filled, visible section types (order preserved).
 */
export function filledVisibleSectionTypes(sections: FilledSectionInput[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of sections) {
    if (s.visible !== true) continue; // hidden/null → never counts (would not render).
    const type = s.type;
    if (!type) continue; // a typeless row cannot map to a section type.
    // Coerce the JSONB content to a plain record for the by-type content probe; a
    // non-object (array/scalar/null) has no content fields → treated as empty.
    const content: ContentRecord =
      s.content && typeof s.content === 'object' && !Array.isArray(s.content)
        ? (s.content as ContentRecord)
        : {};
    if (!hasContentFor(type, content)) continue; // empty → nothing to lose.
    if (seen.has(type)) continue; // one entry per type (the warning lists types).
    seen.add(type);
    out.push(type);
  }
  return out;
}
