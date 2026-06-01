/**
 * deriveCompleteness — the advisory, data-derived completeness checklist
 * (ONB-01 / D-P4-08).
 *
 * A PURE function over the rows the editor has ALREADY loaded — there is NO new
 * table, NO extra query, NO Supabase client, NO RPC. It transforms the
 * already-fetched profile + sections into a small advisory list of done/todo
 * items that nudge a non-technical user toward a publish-ready portfolio.
 *
 * ADVISORY ONLY (the load-bearing constraint, D-P4-08): the returned list carries
 * NO "blocked" / "disabled" flag and the caller MUST NEVER disable or block
 * Publish from it. It is guidance, not a gate. The hard noindex-until-complete
 * gate is a SEPARATE, later concern (P6 SAFE-04) — this checklist never enforces
 * it. Completing every item simply shows an encouraging "you're ready to publish"
 * state; an incomplete checklist still lets the user publish.
 *
 * Field names are sourced verbatim from the live Zod schemas:
 *   - profile.display_name / profile.avatar_url  (`@/lib/validations/profile.ts`)
 *   - about.bio                                  (`aboutContentSchema`)
 *   - projects.items[]                           (`projectsContentSchema`)
 *   - contact.email_public                       (`contactContentSchema`)
 *
 * Source: 04-RESEARCH.md "Completeness checklist derivation" + the schema field
 * names in `@/lib/validations/sections.ts` / `@/lib/validations/profile.ts`.
 */

/**
 * One advisory checklist item. `done` is the derived predicate; `sectionType`
 * (when present) lets the UI link a todo row to the relevant section so the user
 * can jump straight to it (it sets the Zustand `activeSectionId` — UI only).
 */
export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  sectionType?: string;
}

/** The already-loaded shape this derives from — a subset of PortfolioData. */
export interface CompletenessInput {
  displayName?: string | null;
  avatarUrl?: string | null;
  sections: { type: string; content: unknown }[];
}

/**
 * Derive the five advisory completeness items from already-loaded rows. PURE —
 * no I/O, no DB, no new table. Returns the list only; it never implies a publish
 * block (D-P4-08).
 */
export function deriveCompleteness(data: CompletenessInput): ChecklistItem[] {
  // Find a section's content by type. Cast to a loose record so we can read the
  // schema-named fields without dragging the full content union in here (this
  // file must stay dependency-light and pure).
  const find = (t: string): Record<string, unknown> | undefined =>
    data.sections.find((s) => s.type === t)?.content as
      | Record<string, unknown>
      | undefined;

  const nonEmptyString = (v: unknown): boolean =>
    typeof v === 'string' && v.trim().length > 0;

  const about = find('about');
  const projects = find('projects');
  const contact = find('contact');

  const projectItems = projects?.items;
  const projectCount = Array.isArray(projectItems) ? projectItems.length : 0;

  return [
    { id: 'name', label: 'Add your name', done: nonEmptyString(data.displayName) },
    {
      id: 'about',
      label: 'Write your about',
      done: nonEmptyString(about?.bio),
      sectionType: 'about',
    },
    {
      id: 'project',
      label: 'Add at least one project',
      done: projectCount > 0,
      sectionType: 'projects',
    },
    {
      id: 'contact',
      label: 'Add a contact email',
      done: nonEmptyString(contact?.email_public),
      sectionType: 'contact',
    },
    { id: 'avatar', label: 'Set an avatar', done: nonEmptyString(data.avatarUrl) },
  ]; // advisory ONLY — never disables Publish (D-P4-08; the hard gate is P6 SAFE-04).
}
