'use client';

/**
 * SectionListRow + SectionList (04-UI-SPEC §2, CMS-05 / D-P4-06) — the signature
 * editor affordance: a dnd-kit sortable, FULLY KEYBOARD-OPERABLE section rail.
 *
 * Two exports, co-located because they share the dnd-kit sortable contract:
 *
 *   - `SectionList`  — the `DndContext` container. Owns the sensors (PointerSensor
 *     for mouse/touch + a `KeyboardSensor` wired to `sortableKeyboardCoordinates`
 *     for the hard mouse-free a11y requirement — D-P4-06), the `SortableContext`
 *     (verticalListSortingStrategy), the dnd-kit `announcements` (screen-reader
 *     narration), and the OPTIMISTIC reorder mutation (SHARED-C / RESEARCH
 *     Pattern 3): on `onDragEnd`, `arrayMove` the ids and `reorder.mutate(next)`
 *     with onMutate (cancel + snapshot + optimistic `setQueryData` on
 *     `cmsKeys.sections`), onError (rollback `ctx.previous` + a destructive
 *     Alert — optimistic UI honesty), onSettled (`invalidateQueries`). Reorder is
 *     ONE of only two optimistic operations (the other is the eye-toggle);
 *     content Save is NOT optimistic.
 *
 *   - `SectionListRow` — one sortable row via `useSortable` + `CSS.Transform.toString`
 *     (RESEARCH Pattern 5). Anatomy left→right: a 44px drag handle
 *     (`grip-vertical`, descriptive `aria-label`, cursor grab/grabbing) · the
 *     section title (Label 14/600) · spacer · a status dot · the EyeToggle
 *     (Task 3). The whole row (excluding the handle + eye-toggle hit areas) is the
 *     click target that selects the section into the form panel (sets the Zustand
 *     `activeSectionId` — UI selection state, never server data).
 *
 * Two-layer identity (SHARED-E): chrome tokens ONLY (Evergreen/Copper). No inline
 * hex, no template-token reach. Reduced motion: no scale/shadow lift — the
 * placeholder line + announcements carry the reorder (UI-SPEC Motion).
 *
 * Source: dnd-kit sortable preset [VERIFIED: @dnd-kit/sortable 10.0.0 +
 * @dnd-kit/core 6.3.1] (RESEARCH Pattern 5); the 44px-hit + focus-ring idiom from
 * src/components/ui/checkbox.tsx; the optimistic mutation from RESEARCH Pattern 3
 * on the makeQueryClient substrate.
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
import { GripVertical } from 'lucide-react';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { reorderSectionsAction } from '@/lib/cms/reorder-sections-action';
import { cmsKeys } from '@/lib/query/cms-keys';
import { useUIStore } from '@/lib/stores/uiStore';

import { EyeToggle } from './eye-toggle';

/**
 * The editor's view of a section row — UI-selection + visibility + a content cue.
 * This is the shape the section list holds in the TanStack cache
 * (`cmsKeys.sections`); it carries NO heavy section content (that stays under
 * `cmsKeys.section(id)`), only what the rail renders.
 */
export interface EditorSection {
  id: string;
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
}

/**
 * One sortable row. `useSortable` provides the drag transform + the handle
 * `attributes`/`listeners` (applied to the 44px handle ONLY, so the rest of the
 * row stays the selection click target).
 */
export function SectionListRow({ section, portfolioId, username }: SectionListRowProps) {
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
            eye-toggle). Selecting sets the Zustand activeSectionId (UI state). */}
        <button
          type="button"
          onClick={() => setActiveSectionId(section.id)}
          aria-pressed={selected}
          className="flex flex-1 items-center gap-2 truncate text-left outline-none"
        >
          <span className={`truncate text-sm font-semibold ${titleTone}`}>{title}</span>
          {!visible ? (
            <span className="shrink-0 text-[13px] leading-tight text-muted-foreground">
              Hidden
            </span>
          ) : null}
        </button>

        {/* status dot + eye-toggle (their hit areas are excluded from selection). */}
        {statusDot}
        <EyeToggle
          sectionId={section.id}
          title={title}
          visible={visible}
          portfolioId={portfolioId}
          username={username}
        />
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
}

/**
 * The `DndContext` container: sensors (mouse + KEYBOARD a11y), `SortableContext`,
 * announcements, and the optimistic reorder mutation. Renders an ordered list of
 * `SectionListRow`s.
 */
export function SectionList({ sections, portfolioId, username }: SectionListProps) {
  const queryClient = useQueryClient();
  const setDragState = useUIStore((s) => s.setDragState);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const sectionsKey = cmsKeys.sections(portfolioId);

  // The optimistic reorder mutation (SHARED-C / RESEARCH Pattern 3). Reorder is
  // ONE of only two optimistic editor operations.
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = sections.map((s) => s.id);

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragState('idle');
    if (over && active.id !== over.id) {
      const next = arrayMove(
        ids,
        ids.indexOf(active.id as string),
        ids.indexOf(over.id as string),
      );
      commitOrder(next);
    }
  }

  // Screen-reader narration (UI-SPEC §2 copy) — overrides dnd-kit defaults.
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(sections, active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${titleOf(sections, active.id)} moved to position ${positionOf(ids, over.id)} of ${ids.length}.`
        : `${titleOf(sections, active.id)} is no longer over a drop position.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${titleOf(sections, active.id)} dropped at position ${positionOf(ids, over.id)} of ${ids.length}.`
        : `${titleOf(sections, active.id)} dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${titleOf(sections, active.id)} returned to its position.`,
  };

  return (
    <div className="flex flex-col gap-2">
      {reorderError ? <Alert variant="error">{reorderError}</Alert> : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ announcements }}
        onDragStart={() => setDragState('dragging')}
        onDragCancel={() => setDragState('idle')}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="overflow-hidden rounded-md bg-surface-muted">
            {sections.map((section) => (
              <SectionListRow
                key={section.id}
                section={section}
                portfolioId={portfolioId}
                username={username}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
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
