'use client';

/**
 * SectionListRow + SectionList (04-UI-SPEC §2 / 13.1-UI-SPEC §1-2, CMS-05 / D-P4-06 /
 * D-06 / D-07 / D-08 / D-03) — the signature editor affordance: a dnd-kit sortable,
 * FULLY KEYBOARD-OPERABLE section rail, NOW reshaped into the two D-06 groups.
 *
 * Two exports, co-located because they share the dnd-kit sortable contract:
 *
 *   - `SectionList`  — the two-group container (13.1 reshape). It groups EVERY present
 *     row by template support via the pure `groupSectionsForRail` (Plan-03, over ALL
 *     present rows — Pitfall 4) into "On your page" (supported) and a collapsed
 *     "Other content (N)" (present-but-unsupported). Each group is its OWN
 *     `DndContext` + `SortableContext` (verticalListSortingStrategy) with a per-group
 *     STABLE dnd id derived from the `section-list-dnd` precedent, its own
 *     `KeyboardSensor` (a11y), and its own `announcements` that NAME the group. The
 *     OPTIMISTIC reorder mutation (SHARED-C / RESEARCH Pattern 3) is shared: a drag in
 *     EITHER group commits a single `reorderSectionsAction` over the WHOLE shared
 *     `sort_order` (grouping is purely visual; the page is driven by one order). The
 *     "Other content" group is a collapsible disclosure (ephemeral local `useState`,
 *     NO `uiStore` field — D-07), omitted when N=0. A rail-bottom dashed
 *     "+ Add section" button opens the picker (D-08); each row carries a `trash-2`
 *     remove affordance opening the uniform remove confirm (D-03).
 *
 *   - `SectionListRow` — one sortable row via `useSortable` + `CSS.Transform.toString`
 *     (RESEARCH Pattern 5). Anatomy left→right: a 44px drag handle (`grip-vertical`) ·
 *     the section title (Label 14/600) · a badge ("Hidden" for a supported-but-hidden
 *     row OR "Not shown on {Template}" for an unsupported row — the two axes never
 *     collide) · spacer · a status dot · the EyeToggle · a 44px `trash-2` remove
 *     affordance. The row (excluding handle/eye/remove hit areas) is the selection
 *     click target (sets the Zustand `activeSectionId` — UI selection only).
 *
 * Two-layer identity (SHARED-E): chrome tokens ONLY (Evergreen/Copper). No inline
 * hex, no template-token reach. The unsupported badge resolves the active template's
 * name via the ZOD-FREE `template-meta.ts` (`resolveTemplateMeta`) — NEVER
 * `registry.ts` (D-25 / D-15). Reduced motion: no scale/shadow lift.
 *
 * Source: dnd-kit sortable preset [VERIFIED: @dnd-kit/sortable 10.0.0 +
 * @dnd-kit/core 6.3.1] (RESEARCH Pattern 5); the 44px-hit + focus-ring idiom from
 * src/components/ui/checkbox.tsx; the optimistic mutation from RESEARCH Pattern 3;
 * the dashed AddItemCard idiom + trash-2 remove idiom from item-card.tsx.
 */
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { resolveTemplateMeta } from '@/components/templates/template-meta';
import { reorderSectionsAction } from '@/lib/cms/reorder-sections-action';
import { groupSectionsForRail } from '@/lib/templates/rail-grouping';
import { cmsKeys } from '@/lib/query/cms-keys';
import { useUIStore } from '@/lib/stores/uiStore';

import { AddSectionTypePicker } from './add-section-picker';
import { EyeToggle } from './eye-toggle';
import { RemoveSectionConfirm } from './remove-section-confirm';

/**
 * The editor's view of a section row — UI-selection + visibility + a content cue.
 * This is the shape the section list holds in the TanStack cache
 * (`cmsKeys.sections`); it carries NO heavy section content (that stays under
 * `cmsKeys.section(id)`), only what the rail renders.
 */
export interface EditorSection {
  id: string;
  /** The section's soft-enum type — drives the D-06 support grouping (Pitfall 4). */
  type: string;
  /** The display title for the row (Label 14/600). */
  title: string;
  /** Whether the section is shown on the public page (drives the eye-toggle). */
  visible: boolean;
  /** Whether the section has real content yet (drives the status-dot fill). */
  hasContent: boolean;
}

/** Reorder a section array to match an explicit ordered id list (optimistic helper). */
function reorderByIds(sections: EditorSection[], orderedIds: string[]): EditorSection[] {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const next: EditorSection[] = [];
  for (const id of orderedIds) {
    const s = byId.get(id);
    if (s) next.push(s);
  }
  // Append any not named in the ordered list (defensive; keeps every row present).
  for (const s of sections) if (!orderedIds.includes(s.id)) next.push(s);
  return next;
}

const REORDER_ERROR =
  'We couldn’t save the new order — it’s been put back. Please try again.';

interface SectionListRowProps {
  section: EditorSection;
  /** The portfolio id — scopes the eye-toggle's optimistic `cmsKeys.sections` flip. */
  portfolioId: string;
  /** The owner's username, passed to the visibility action's revalidate. */
  username?: string;
  /**
   * When true, this row is UNSUPPORTED on the active template (it lives in "Other
   * content"): it shows the "Not shown on {Template}" badge instead of "Hidden".
   */
  unsupported?: boolean;
  /** The active template's display name — woven into the unsupported badge (D-15). */
  templateName: string;
  /** Open the uniform remove-section confirm for this row (D-03). */
  onRequestRemove: (section: EditorSection) => void;
}

/**
 * One sortable row. `useSortable` provides the drag transform + the handle
 * `attributes`/`listeners` (applied to the 44px handle ONLY, so the rest of the
 * row stays the selection click target).
 */
export function SectionListRow({
  section,
  portfolioId,
  username,
  unsupported = false,
  templateName,
  onRequestRemove,
}: SectionListRowProps) {
  const activeSectionId = useUIStore((s) => s.activeSectionId);
  const setActiveSectionId = useUIStore((s) => s.setActiveSectionId);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const selected = activeSectionId === section.id;
  const { title, visible, hasContent } = section;

  // Reduced-motion-safe: dnd-kit still applies the translate transform (needed to
  // track the pointer), but we suppress the scale/shadow lift in the className.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Row container token classes per the UI-SPEC §2 state table.
  const base =
    'group relative flex min-h-11 items-center gap-2 border-b border-border ' +
    'bg-surface px-2 py-2 text-left outline-none transition-colors ' +
    'hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'focus-visible:outline-ring motion-reduce:transition-none';
  const draggingState = isDragging
    ? 'z-10 shadow-card motion-reduce:shadow-none'
    : '';
  // Active/selected: a 3px brand left marker (rendered as a child below) + the row
  // already on surface. Hidden: title/handle drop to muted (the eye-off glyph +
  // "Hidden" tag carry the state, NOT opacity alone — color-independence).
  const titleTone = visible ? 'text-foreground' : 'text-muted-foreground';

  // Status dot: brand-filled when visible+has-content; hollow border-strong ring
  // when visible-but-empty; omitted when hidden (the eye-off already signals it).
  const statusDot = !visible ? null : hasContent ? (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-full bg-brand"
    />
  ) : (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 rounded-full border border-border-strong"
    />
  );

  // The two badge axes stay SEPARATE (color-independence — they differ by WORD):
  //   · an UNSUPPORTED row shows "Not shown on {Template}" (Caption, muted) — D-06/D-15;
  //   · a SUPPORTED-but-HIDDEN row keeps the existing "Hidden" tag.
  // An unsupported row's hidden state is already implied by its group + badge, so the
  // "Not shown on …" badge takes precedence on those rows.
  const badge = unsupported ? (
    <span className="shrink-0 text-[13px] leading-tight text-muted-foreground">
      Not shown on {templateName}
    </span>
  ) : !visible ? (
    <span className="shrink-0 text-[13px] leading-tight text-muted-foreground">
      Hidden
    </span>
  ) : null;

  return (
    <li ref={setNodeRef} style={style} className="list-none">
      <div className={`${base} ${draggingState}`}>
        {/* 3px brand left marker — selected only (ties the row to its panel). */}
        {selected ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-[3px] bg-brand"
          />
        ) : null}

        {/* 44px drag handle — the activator. Keyboard: Space lifts → arrows move →
            Space drops → Esc cancels (KeyboardSensor on the list). */}
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`Reorder ${title} (use arrow keys after pressing space)`}
          className={
            'flex size-11 shrink-0 cursor-grab items-center justify-center ' +
            'text-muted-foreground outline-none hover:text-foreground ' +
            'focus-visible:outline-2 focus-visible:-outline-offset-2 ' +
            'focus-visible:outline-ring active:cursor-grabbing'
          }
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" className="size-5" />
        </button>

        {/* The selection click target: the title fills the row (minus handle +
            eye-toggle + remove). Selecting sets the Zustand activeSectionId. */}
        <button
          type="button"
          onClick={() => setActiveSectionId(section.id)}
          aria-pressed={selected}
          className="flex flex-1 items-center gap-2 truncate text-left outline-none"
        >
          <span className={`truncate text-sm font-semibold ${titleTone}`}>{title}</span>
          {badge}
        </button>

        {/* status dot + eye-toggle + remove (their hit areas are excluded from
            selection). */}
        {statusDot}
        <EyeToggle
          sectionId={section.id}
          title={title}
          visible={visible}
          portfolioId={portfolioId}
          username={username}
        />
        <button
          type="button"
          onClick={() => onRequestRemove(section)}
          aria-label={`Remove ${title} from your portfolio`}
          className={
            'flex size-11 shrink-0 items-center justify-center rounded-sm ' +
            'text-muted-foreground outline-none transition-colors hover:text-destructive ' +
            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ' +
            'motion-reduce:transition-none'
          }
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      </div>
    </li>
  );
}

interface SectionListProps {
  /** The ordered sections (source of truth: the TanStack `cmsKeys.sections` cache). */
  sections: EditorSection[];
  /** The portfolio id — scopes the optimistic cache key + reorder. */
  portfolioId: string;
  /** The owner's username — passed to the reorder/visibility revalidate. */
  username?: string;
  /**
   * The active template's spec — drives the D-06 two-group split via
   * `groupSectionsForRail`. Allowed in the (chrome) editor (D-25 NOTE); never leaks
   * to the public bundle.
   */
  spec: import('@/components/templates/minimal/spec').TemplateSpec;
  /** The active template slug — resolves the "Not shown on {Template}" badge name (D-15). */
  activeSlug: string;
  /**
   * Called after a section is successfully added via the picker so the shell can
   * select + first-fill the freshly-added section (D-18/D-21).
   */
  onAdded: (sectionId: string, type: string) => void;
  /**
   * Called after a section is successfully removed so the shell can clear the
   * selection if the removed section was active.
   */
  onRemoved: (sectionId: string) => void;
}

/**
 * The two-group rail container. Splits the rows by template support (D-06), renders
 * each group as its own keyboard-operable sortable list, mounts the "+ Add section"
 * picker (D-08) + the uniform remove confirm (D-03). One shared `sort_order` drives
 * the public page — the grouping is purely visual.
 */
export function SectionList({
  sections,
  portfolioId,
  username,
  spec,
  activeSlug,
  onAdded,
  onRemoved,
}: SectionListProps) {
  const queryClient = useQueryClient();
  const setDragState = useUIStore((s) => s.setDragState);
  const [reorderError, setReorderError] = useState<string | null>(null);

  // D-07: the "Other content" collapse is EPHEMERAL local state (collapsed by
  // default) — NEVER a uiStore field, never persisted.
  const [otherExpanded, setOtherExpanded] = useState(false);

  // D-08: the add-section picker open state (local; the trigger is the rail button).
  const [pickerOpen, setPickerOpen] = useState(false);
  // D-03: the section pending a remove-confirm (null = no dialog open).
  const [pendingRemove, setPendingRemove] = useState<EditorSection | null>(null);

  const sectionsKey = cmsKeys.sections(portfolioId);

  // The active template's display name (zod-free, D-15-safe) for the unsupported badge.
  const templateName = resolveTemplateMeta(activeSlug).name;

  // D-06: split ALL present rows by template support (Pitfall 4 — empty/hidden/
  // unsupported rows are GROUPED, never dropped). The shared sort_order is preserved
  // within each group (input order), so the optimistic reorder over the WHOLE list
  // still drives the page.
  const { onYourPage, otherContent } = groupSectionsForRail(sections, spec);

  // The full ordered id list (BOTH groups) — the shared sort_order the page reads.
  const allIds = sections.map((s) => s.id);
  // The set of types already present (for the picker's addable filter).
  const presentTypes = sections.map((s) => s.type);

  // The optimistic reorder mutation (SHARED-C / RESEARCH Pattern 3). Reorder is
  // ONE of only two optimistic editor operations. Shared by both groups: a drag in
  // either group rebuilds the WHOLE ordered id list and commits one action.
  const reorder = useMutation({
    mutationFn: (orderedIds: string[]) => reorderSectionsAction(orderedIds, username),
    onMutate: async (orderedIds: string[]) => {
      setReorderError(null);
      await queryClient.cancelQueries({ queryKey: sectionsKey });
      const previous = queryClient.getQueryData<EditorSection[]>(sectionsKey);
      queryClient.setQueryData<EditorSection[]>(sectionsKey, (old) =>
        old ? reorderByIds(old, orderedIds) : old,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back the optimistic order + announce (optimistic UI honesty — never
      // claim an order that didn't persist).
      if (ctx?.previous) queryClient.setQueryData(sectionsKey, ctx.previous);
      setReorderError(REORDER_ERROR);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sectionsKey });
    },
  });

  // The reorder also resolves against the server when the mutation returns
  // { ok:false } (a handled error, not a throw) — treat that as an error too.
  function commitOrder(orderedIds: string[]) {
    reorder.mutate(orderedIds, {
      onSuccess: (result) => {
        if (!result.ok) {
          // Server-handled failure: roll back to the server truth + announce.
          queryClient.invalidateQueries({ queryKey: sectionsKey });
          setReorderError(REORDER_ERROR);
        }
      },
    });
  }

  /**
   * Reorder WITHIN a group, then rebuild the WHOLE shared order so the single
   * `sort_order` the page reads stays consistent. A drag never crosses groups (each
   * group is its own SortableContext); the moved id stays in its group's relative
   * slot and the other group's rows keep their positions.
   */
  function reorderWithinGroup(groupIds: string[], activeId: string, overId: string) {
    const from = groupIds.indexOf(activeId);
    const to = groupIds.indexOf(overId);
    if (from === -1 || to === -1) return;
    const nextGroup = arrayMove(groupIds, from, to);
    // Rebuild the full order: walk the original full list, but emit this group's ids
    // in their NEW relative order while leaving every other id in place.
    const groupSet = new Set(groupIds);
    let cursor = 0;
    const nextAll = allIds.map((id) => (groupSet.has(id) ? nextGroup[cursor++] : id));
    commitOrder(nextAll);
  }

  function handleAdded(sectionId: string, type: string) {
    setPickerOpen(false);
    onAdded(sectionId, type);
  }

  function handleRemoved(sectionId: string) {
    setPendingRemove(null);
    onRemoved(sectionId);
  }

  // The picker is offered while at least one form-having type is still addable. The
  // 12 form-having types (blog_preview excluded) are the picker's universe; when all
  // are present the dashed button is replaced by the calm "all present" line.
  const ADDABLE_UNIVERSE = 12;
  const allPresent =
    new Set(presentTypes.filter((t) => t !== 'blog_preview')).size >= ADDABLE_UNIVERSE;

  return (
    <div className="flex flex-col gap-4">
      {reorderError ? <Alert variant="error">{reorderError}</Alert> : null}

      {/* ── "On your page" — supported rows (always present) ─────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="px-1 text-sm font-semibold text-foreground">On your page</p>
        <SectionGroupList
          domId="section-list-dnd-onpage"
          groupLabel="On your page"
          rows={onYourPage}
          portfolioId={portfolioId}
          username={username}
          unsupported={false}
          templateName={templateName}
          onReorder={reorderWithinGroup}
          onDragStateChange={setDragState}
          onRequestRemove={setPendingRemove}
        />
      </div>

      {/* ── "Other content (N)" — unsupported rows (collapsed; omitted when N=0) ─ */}
      {otherContent.length > 0 ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setOtherExpanded((v) => !v)}
            aria-expanded={otherExpanded}
            aria-controls="rail-other-content"
            className={
              'flex min-h-11 items-center gap-1.5 rounded-md px-1 text-left outline-none ' +
              'transition-colors hover:text-foreground ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
              'motion-reduce:transition-none'
            }
          >
            <ChevronDown
              aria-hidden="true"
              className={
                'size-4 shrink-0 text-muted-foreground transition-transform ' +
                (otherExpanded ? '' : '-rotate-90 ') +
                'motion-reduce:transition-none'
              }
            />
            <span className="text-sm font-semibold text-foreground">Other content</span>
            <span className="text-[13px] leading-tight tabular-nums text-muted-foreground">
              ({otherContent.length})
            </span>
          </button>
          <div id="rail-other-content" hidden={!otherExpanded}>
            {otherExpanded ? (
              <SectionGroupList
                domId="section-list-dnd-other"
                groupLabel="Other content"
                rows={otherContent}
                portfolioId={portfolioId}
                username={username}
                unsupported
                templateName={templateName}
                onReorder={reorderWithinGroup}
                onDragStateChange={setDragState}
                onRequestRemove={setPendingRemove}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ── "+ Add section" — dashed full-width button (D-08) ────────────────── */}
      {allPresent ? (
        <p className="px-1 text-[13px] leading-tight text-muted-foreground">
          Every section type is already on your page.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={
            'flex min-h-11 w-full items-center justify-center gap-2 rounded-md ' +
            'border-[1.5px] border-dashed border-border-strong bg-transparent ' +
            'px-4 py-3 text-sm font-semibold text-brand outline-none transition-colors ' +
            'hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 ' +
            'focus-visible:outline-ring motion-reduce:transition-none'
          }
        >
          <Plus aria-hidden="true" className="size-4" />
          Add section
        </button>
      )}

      {/* ── The add-section picker dialog (D-08/D-19), mounted while open ─────── */}
      {pickerOpen ? (
        <AddSectionTypePicker
          presentTypes={presentTypes}
          username={username}
          onClose={() => setPickerOpen(false)}
          onAdded={handleAdded}
        />
      ) : null}

      {/* ── The uniform remove-section confirm (D-03), mounted while pending ──── */}
      {pendingRemove ? (
        <RemoveSectionConfirm
          sectionId={pendingRemove.id}
          sectionTitle={pendingRemove.title}
          username={username}
          onClose={() => setPendingRemove(null)}
          onRemoved={handleRemoved}
        />
      ) : null}
    </div>
  );
}

interface SectionGroupListProps {
  /** The stable per-group DndContext id (hydration-stable aria-describedby). */
  domId: string;
  /** The group's display name — woven into the per-group announcements. */
  groupLabel: string;
  rows: EditorSection[];
  portfolioId: string;
  username?: string;
  /** Whether THIS group is the unsupported "Other content" group. */
  unsupported: boolean;
  templateName: string;
  /** Reorder within this group (rebuilds the shared whole-list order). */
  onReorder: (groupIds: string[], activeId: string, overId: string) => void;
  onDragStateChange: (state: 'idle' | 'dragging') => void;
  onRequestRemove: (section: EditorSection) => void;
}

/**
 * One group's `DndContext` + `SortableContext` + per-group announcements. Each group
 * has its OWN keyboard sensor + stable dnd id so reorder + a11y are scoped per group;
 * a drag rebuilds the WHOLE shared order via `onReorder` so the single `sort_order`
 * the page reads stays consistent (D-06 — grouping is visual only).
 */
function SectionGroupList({
  domId,
  groupLabel,
  rows,
  portfolioId,
  username,
  unsupported,
  templateName,
  onReorder,
  onDragStateChange,
  onRequestRemove,
}: SectionGroupListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = rows.map((r) => r.id);

  function handleDragEnd({ active, over }: DragEndEvent) {
    onDragStateChange('idle');
    if (over && active.id !== over.id) {
      onReorder(ids, active.id as string, over.id as string);
    }
  }

  // Screen-reader narration (UI-SPEC §1 copy) — names the GROUP so a keyboard user
  // knows which list they're reordering within.
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(rows, active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${titleOf(rows, active.id)} moved to position ${positionOf(ids, over.id)} of ${ids.length} in ${groupLabel}.`
        : `${titleOf(rows, active.id)} is no longer over a drop position.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${titleOf(rows, active.id)} dropped at position ${positionOf(ids, over.id)} of ${ids.length} in ${groupLabel}.`
        : `${titleOf(rows, active.id)} dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${titleOf(rows, active.id)} returned to its position in ${groupLabel}.`,
  };

  return (
    <DndContext
      // Stable explicit id per group: dnd-kit's useUniqueId returns this verbatim, so
      // the generated aria-describedby is identical on the server render and on client
      // hydration (the section-list-dnd precedent; one rail per dashboard ⇒ a constant
      // per-group id is unique).
      id={domId}
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements }}
      onDragStart={() => onDragStateChange('dragging')}
      onDragCancel={() => onDragStateChange('idle')}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="overflow-hidden rounded-md bg-surface-muted">
          {rows.map((section) => (
            <SectionListRow
              key={section.id}
              section={section}
              portfolioId={portfolioId}
              username={username}
              unsupported={unsupported}
              templateName={templateName}
              onRequestRemove={onRequestRemove}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

/** Resolve a section's display title from a dnd-kit id (announcement helper). */
function titleOf(sections: EditorSection[], id: string | number): string {
  return sections.find((s) => s.id === id)?.title ?? 'section';
}

/** 1-based position of an id in the ordered list (announcement helper). */
function positionOf(ids: string[], id: string | number): number {
  return ids.indexOf(id as string) + 1;
}
