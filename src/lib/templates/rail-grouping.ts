/**
 * groupSectionsForRail — the pure D-06 two-group rail derivation (correctness gap #2).
 *
 * The editor rail (`section-list-row.tsx` / `editor-shell.tsx`) splits the user's
 * sections into "On your page" (the active template renders them) vs "Other content"
 * (present but NOT rendered by the active template — still editable, never deleted —
 * the EDIT-ALL guarantee). This is the pure derivation that performs that split.
 *
 * THE LOAD-BEARING CAVEAT (RESEARCH Pitfall 4 — correctness gap #2): the rail MUST
 * group EVERY PRESENT row by template support, INCLUDING empty + hidden + unsupported
 * rows. It must NOT reuse `filledVisibleSectionTypes` / `unsupportedFilledSections` —
 * those filter to FILLED + VISIBLE (built for the template-SWITCH "what would I lose"
 * warning), so they would DROP a freshly-added, still-blank, hidden `services` row
 * from the rail entirely. The rail shows ALL rows; only `spec.sections[type]?.supported`
 * decides the group.
 *
 * VISIBILITY IS A SEPARATE AXIS: the eye-toggle (`visible`) is NEVER a grouping input.
 * A SUPPORTED-but-hidden row stays under "On your page" (the UI marks it "Hidden"); an
 * UNSUPPORTED row stays under "Other content" regardless of its visibility. The two
 * axes (support → group; visibility → a per-row badge) are orthogonal.
 *
 * PURE — no Supabase, no `next`, no DOM. The ONLY import is the `TemplateSpec` TYPE,
 * mirroring `mismatch.ts` / `completeness.ts` purity discipline (the `node` vitest
 * project asserts it without I/O). This module does NOT import `filled-sections.ts`.
 *
 * Source: the support predicate is the `mismatch.ts:43-47` predicate (reused as
 * `isSupported`); the "group all present rows" contract is RESEARCH Pitfall 4 +
 * tests/unit/editor/rail-grouping.test.ts (the Plan-01 RED).
 */
import type { TemplateSpec } from '@/components/templates/minimal/spec';

/**
 * Whether the active template RENDERS this section type. Mirrors the
 * `mismatch.ts:43-47` predicate EXACTLY: a type the spec OMITS (no entry) OR marks
 * `supported !== true` is unsupported. This is the SINGLE grouping axis — never the
 * row's `visible` flag.
 */
export function isSupported(spec: TemplateSpec, type: string): boolean {
  const entry = spec.sections[type];
  return !!entry && entry.supported === true;
}

/** The minimal row shape the rail derivation needs — a subset of the loaded section
 *  rows. `visible` is carried for the per-row badge the UI renders, but it is NEVER
 *  used to GROUP (the separate-axis rule). Content is unused here (grouping is by
 *  support, not fill — Pitfall 4). */
export interface RailRow {
  type: string;
  content?: unknown;
  visible?: boolean | null;
}

/** The two-group split the rail renders. */
export interface RailGroups<T extends RailRow> {
  /** Rows the active template renders (supported). Input order preserved. */
  onYourPage: T[];
  /** Present-but-not-rendered rows (unsupported / omitted). Input order preserved. */
  otherContent: T[];
}

/**
 * Split ALL present rows into the two rail groups purely by `spec.sections[type]`
 * support. EMPTY / HIDDEN / UNSUPPORTED rows are GROUPED (under "Other content"),
 * NEVER dropped (the filled-visible filter would drop them — this must not). Relative
 * input order is preserved WITHIN each group (the shared sort_order still drives the
 * page), so the caller can render each group in its existing order.
 */
export function groupSectionsForRail<T extends RailRow>(
  rows: readonly T[],
  spec: TemplateSpec,
): RailGroups<T> {
  const onYourPage: T[] = [];
  const otherContent: T[] = [];
  for (const row of rows) {
    if (isSupported(spec, row.type)) {
      onYourPage.push(row);
    } else {
      otherContent.push(row);
    }
  }
  return { onYourPage, otherContent };
}
