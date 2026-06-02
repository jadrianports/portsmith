/**
 * unsupportedFilledSections — the spec-aware mismatch predicate
 * (TMPL-02 success criterion 3 / D-P7-11).
 *
 * A PURE function over already-derived data — NO Supabase, NO DB, NO client, NO new
 * table (mirrors `@/lib/cms/completeness.ts`'s purity discipline). It answers one
 * question for the template switcher's confirm step: which section types does the
 * user have FILLED + VISIBLE that the CANDIDATE template cannot render?
 *
 * ADVISORY ONLY (the load-bearing constraint, D-P7-11/12): the returned list is a
 * WARNING surfaced in the preview/confirm step — the consumer (the 07-05 confirm
 * bar) MUST NEVER disable or block the switch from it. Switching is always allowed;
 * the unrendered section rows stay in the DB untouched (the TMPL-02 lossless
 * guarantee), so switching back restores everything. This is a forward-looking
 * safety net for future templates / v2 marketer section types.
 *
 * v1 BEHAVIOR: returns `[]` for every real switch — both shipped templates cover all
 * 7 CMS-produced types (D-P7-05), so the warning never fires in v1. The unit test
 * MUST therefore include a synthetic v2-shaped fires-case to PROVE the predicate
 * actually fires (criterion 3 is "the warning works", not "the warning is silent").
 *
 * The ONLY import is the `TemplateSpec` TYPE — keeping this module table-free and
 * dependency-light, identical to `completeness.ts`.
 */
import type { TemplateSpec } from '@/components/templates/minimal/spec';

/**
 * The section types the candidate template cannot render but the user has filled and
 * left visible.
 *
 * @param filledVisibleTypes - `section.type` for each row that has content AND is
 *   `visible === true` (derived upstream by the caller via the editor's
 *   `hasContentFor` idiom + the `visible` flag — this fn does not re-derive it).
 * @param candidateSpec - the spec of the template being switched TO, resolved via
 *   `resolveSpec(candidateSlug)` from the registry (NEVER hardcoded `minimalSpec`).
 * @returns the subset of `filledVisibleTypes` the candidate marks `supported: false`
 *   OR omits from its `sections` map entirely. `[]` means a lossless switch.
 */
export function unsupportedFilledSections(
  filledVisibleTypes: string[],
  candidateSpec: TemplateSpec,
): string[] {
  return filledVisibleTypes.filter((type) => {
    const entry = candidateSpec.sections[type];
    // Unsupported when the candidate omits the type entirely (no entry) OR declares
    // it `supported !== true`. Either way the user's filled section would not render.
    return !entry || entry.supported !== true;
  });
}
