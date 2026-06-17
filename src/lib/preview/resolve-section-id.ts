/**
 * The PURE section-type/region → `activeSectionId` resolver (Phase 27 — EDIT-02 / D-06).
 *
 * The single source of truth for the editor's sentinel-panel ids AND the pure routing
 * function the Plan-03 preview listener calls. Kept here (not in `editor-shell.tsx`) as a
 * PLAIN, import-free module so:
 *   - the resolver is unit-testable in isolation (no `'use client'` shell to mount), and
 *   - one definition of each sentinel id is shared by the editor + the resolver + its test
 *     (RESEARCH / PATTERNS note — avoid two drifting copies of `'__contact_socials__'`).
 *
 * IMPORT-FREE (mirrors `cookie.ts` / `bridge-messages.ts`): no Zod, no registry, no
 * browser API. It only routes the region/sentinel-vs-real-type decision; the EDITOR owns
 * UUID resolution and passes its `resolveSectionId` in as `resolveRowId` (RESEARCH Pattern
 * 4 KEY point — the bridge/resolver stay zero-knowledge of editor state; no UUID list
 * crosses the boundary).
 */

/**
 * The sentinel `activeSectionId` for the PROFILE / IDENTITY panel (WR-02). The profile is
 * not a `sections` row, so it gets a non-UUID id; selecting the "Profile" rail entry sets
 * this, routing the panel to the ProfileForm.
 */
export const PROFILE_PANEL_ID = '__profile__';

/**
 * The sentinel `activeSectionId` for the TEMPLATE picker panel (07-05). Like the profile,
 * the template gallery is not a `sections` row; selecting the "Template" rail entry sets
 * this, routing the panel to the TemplatePicker.
 */
export const TEMPLATE_PANEL_ID = '__template__';

/**
 * The sentinel `activeSectionId` for the BLOG authoring panel (13.2-06 / D-19). The blog
 * panel is not a `sections` row (posts are first-class `blog_posts` rows); selecting the
 * "Blog" rail entry sets this, routing the panel to the BlogPanel. NOTE (A4): a
 * `blog_preview` SECTION click flows through the real-type branch (resolves to its own row
 * UUID), NOT to this sentinel — this id is reserved for explicit rail navigation.
 */
export const BLOG_PANEL_ID = '__blog__';

/**
 * The sentinel `activeSectionId` for the CONTACT & SOCIALS panel (24-03 / D-07). The
 * contact/social settings are `portfolio_settings` columns, not a `sections` row. This is
 * ALSO the region tag the preview bridge sends for a footer click (D-06): the footer
 * carries `data-preview-region="contact"` and emits no `data-section-type`, so the bridge
 * sends this literal and the resolver routes it straight to the Contact & Socials panel.
 */
export const CONTACT_PANEL_ID = '__contact_socials__';

/**
 * Resolve a clicked `sectionType` (or footer region tag) → the editor's `activeSectionId`
 * (EDIT-02 / D-06). Three buckets (RESEARCH Pattern 4):
 *
 *   1. the footer/contact region (`CONTACT_PANEL_ID`) → the Contact & Socials sentinel id
 *      (the footer is not a `data-section-type` section; the bridge sends this region tag);
 *   2. any real section type (`hero`, `projects`, `blog_preview`, …) → delegate to
 *      `resolveRowId(sectionType)`, which returns the section ROW's UUID (the editor's own
 *      `resolveSectionId`/`sectionIdByType` Map) — the bridge never sees UUIDs;
 *   3. a type with no loaded section row → `resolveRowId` returns `null` → this returns
 *      `null` and the editor no-ops the click (matches the checklist's null-no-op).
 *
 * `resolveRowId` is injected (the editor owns it) so this function stays pure + testable.
 */
export function resolvePreviewTarget(
  sectionType: string,
  resolveRowId: (type: string) => string | null,
): string | null {
  // Bucket 1: the footer/contact region tag → the Contact & Socials sentinel panel (D-06).
  if (sectionType === CONTACT_PANEL_ID) return CONTACT_PANEL_ID;

  // Buckets 2 + 3: a real section type → its row UUID (or null → editor no-ops the click).
  return resolveRowId(sectionType);
}
