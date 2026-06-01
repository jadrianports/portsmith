'use client';

/**
 * ItemCard + AddItemCard (04-UI-SPEC §9, CMS-04 / CMS-06; RESEARCH Pitfall 7 +
 * Pattern 5) — the repeatable, profession-agnostic work/showcase item manager.
 *
 * Lives INSIDE a projects / experience / testimonials section's form panel. Each
 * of those section types stores its items as `content.items[]` (max 20) — a JSONB
 * array inside `sections.content`. CRITICAL (RESEARCH Pitfall 7): THERE IS NO
 * `items` TABLE and NO new item server action. EVERY item operation
 * (add / remove / reorder / edit) is a SECTION CONTENT WRITE:
 *
 *   read content → mutate content.items → persist via `saveSectionAction({
 *     sectionId, type, content })` → the action re-validates the WHOLE content via
 *     `validateSectionContent` (the soft-enum gate, server-side) and revalidates
 *     the public page.
 *
 * So item mutations invalidate the SECTION's TanStack key (`cmsKeys.section(id)`),
 * never a separate item key (there is none — `cms-keys.ts` header).
 *
 * REORDER is keyboard-operable via dnd-kit, mirroring the EXACT `useSortable` +
 * `KeyboardSensor` + `sortableKeyboardCoordinates` + `announcements` contract the
 * section rail already ships (`section-list-row.tsx`, 04-05). Reorder is the only
 * OPTIMISTIC item operation (SHARED-C): the item order flips in the local list
 * instantly, then the section save persists; a server failure rolls the order back
 * + raises a destructive Alert (optimistic UI honesty). Add / remove / field edits
 * are NOT optimistic — they show "Saving…" until the action resolves (the same
 * "saves go live, never claim live early" rule the content Save honors).
 *
 * PROFESSION-AGNOSTIC by construction (CONTEXT D-27): the GENERIC card renders
 * title + description for any item; the developer-flavored fields (tech_stack via
 * the ChipInput, live_url / repo_url) are OPTIONAL and surface only for `projects`.
 * Experience adds role/company/dates; testimonials add name/quote/company. A
 * marketer's "Campaigns" section is as valid as a developer's "Projects" — no
 * dev-only assumption is baked into the shared shell.
 *
 * Two-layer identity (SHARED-E): chrome tokens ONLY (Evergreen/Copper). No inline
 * hex, no template-token reach. Reduced-motion-safe (no scale/shadow lift under
 * `prefers-reduced-motion` — the placeholder line + announcements carry it).
 *
 * Source: the dnd-kit sortable + a11y contract from `section-list-row.tsx`
 * [VERIFIED live: @dnd-kit/sortable 10.0.0 + @dnd-kit/core 6.3.1, 04-05]; the
 * section write from `save-section-action.ts` (04-03); the field primitives from
 * `ui/{input,textarea,char-counter}.tsx` + `editor/{url-input,chip-input}.tsx`;
 * `nanoid` for the client-minted item id [VERIFIED: nanoid 5.1.11].
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
import { ChevronDown, GripVertical, Plus, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useCallback, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { saveSectionAction } from '@/lib/cms/save-section-action';

import { ChipInput } from './chip-input';
import { UrlInput } from './url-input';

// ---------------------------------------------------------------------------
// Item model (the GENERIC, profession-agnostic shape)
// ---------------------------------------------------------------------------

/** The item-bearing section types (each stores `content.items[]`, max 20). */
export type ItemSectionType = 'projects' | 'experience' | 'testimonials';

/**
 * The loose item shape the editor manipulates. It is intentionally a superset of
 * the three item schemas (`projectItemSchema` / `experienceItemSchema` /
 * `testimonialItemSchema` in `sections.ts`) keyed by an `id` for dnd-kit + React.
 * The SERVER re-validates the WHOLE content against the per-type schema, so the
 * editor never has to model each schema precisely — it just builds the array and
 * lets `validateSectionContent` (via `saveSectionAction`) be the gate (SHARED-D).
 */
export interface EditorItem {
  /** Client-minted nanoid (the schema requires `id: z.string().min(1)`). */
  id: string;
  [field: string]: unknown;
}

/** Zod `.max(...)` bounds mirrored from sections.ts (no magic numbers). */
const DESCRIPTION_MAX = 1000;
const ITEMS_MAX = 20;

/** Per-type copy + a builder for a fresh blank item (CONTEXT D-27, profession-agnostic). */
const ITEM_CONFIG: Record<
  ItemSectionType,
  { noun: string; addLabel: string; emptyLine: string; blank: () => EditorItem }
> = {
  projects: {
    noun: 'project',
    addLabel: 'Add project',
    emptyLine: 'No projects yet — add your first one.',
    blank: () => ({
      id: nanoid(),
      slug: nanoid(8).toLowerCase(),
      title: '',
      description: '',
      tech_stack: [],
      live_url: '',
      repo_url: '',
    }),
  },
  experience: {
    noun: 'role',
    addLabel: 'Add role',
    emptyLine: 'No roles yet — add your first one.',
    blank: () => ({
      id: nanoid(),
      company: '',
      role: '',
      start_date: '',
      end_date: '',
      description: '',
    }),
  },
  testimonials: {
    noun: 'testimonial',
    addLabel: 'Add testimonial',
    emptyLine: 'No testimonials yet — add your first one.',
    blank: () => ({
      id: nanoid(),
      name: '',
      quote: '',
      company: '',
    }),
  },
};

/** Derive a lowercase url-friendly slug from a title (for the projects `slug`). */
function deriveSlug(title: string, fallback: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s.length > 0 ? s : fallback;
}

/** The collapsed summary line for an item (its title/company/name). */
function summaryOf(type: ItemSectionType, item: EditorItem): string {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  switch (type) {
    case 'projects':
      return str(item.title) || 'Untitled project';
    case 'experience': {
      const role = str(item.role);
      const company = str(item.company);
      if (role && company) return `${role} · ${company}`;
      return role || company || 'Untitled role';
    }
    case 'testimonials':
      return str(item.name) || 'Untitled testimonial';
  }
}

const SAVE_ERROR =
  'We couldn’t save your changes. Please try again.';
const REORDER_ERROR =
  'We couldn’t save the new order — it’s been put back. Please try again.';

// ---------------------------------------------------------------------------
// ItemCard — one sortable, expandable item
// ---------------------------------------------------------------------------

interface ItemCardProps {
  type: ItemSectionType;
  item: EditorItem;
  /** Whether the card starts expanded (a freshly-added item does). */
  startExpanded?: boolean;
  /** Whether the section save is currently in-flight (disables controls). */
  saving: boolean;
  /** Apply a partial field change to this item, then persist the section. */
  onPatch: (id: string, patch: Partial<EditorItem>) => void;
  /** Remove this item, then persist the section (uses the confirm dialog). */
  onRemove: (id: string) => void;
}

/**
 * One sortable item card. `useSortable` provides the drag transform + the handle
 * `attributes`/`listeners` (applied to the 44px handle ONLY). Expanding reveals
 * the per-type fields; collapsing shows the summary line.
 */
export function ItemCard({
  type,
  item,
  startExpanded = false,
  saving,
  onPatch,
  onRemove,
}: ItemCardProps) {
  const [expanded, setExpanded] = useState(startExpanded);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const { noun } = ITEM_CONFIG[type];

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  // Reduced-motion-safe: dnd-kit still applies the translate (to track the
  // pointer), but the scale/shadow lift is suppressed in the className.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  return (
    <li ref={setNodeRef} style={style} className="list-none">
      <div
        className={
          'rounded-md border border-border bg-surface ' +
          (isDragging ? 'z-10 shadow-card motion-reduce:shadow-none' : '')
        }
      >
        {/* Card header: drag handle · summary (the collapse/expand toggle) · remove. */}
        <div className="flex items-center gap-2 px-2 py-2">
          {/* 44px drag handle — the activator. Keyboard: Space lifts → arrows move
              → Space drops → Esc cancels (KeyboardSensor on the list). */}
          <button
            type="button"
            ref={setActivatorNodeRef}
            aria-label={`Reorder ${summaryOf(type, item)} (use arrow keys after pressing space)`}
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

          {/* Summary doubles as the expand/collapse toggle. */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className={
              'flex flex-1 items-center gap-2 truncate text-left outline-none ' +
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
            }
          >
            <ChevronDown
              aria-hidden="true"
              className={
                'size-4 shrink-0 text-muted-foreground transition-transform ' +
                'motion-reduce:transition-none ' +
                (expanded ? '' : '-rotate-90')
              }
            />
            <span className="truncate text-sm font-semibold text-foreground">
              {summaryOf(type, item)}
            </span>
          </button>

          {/* 44px remove button → opens the inline destructive confirm. */}
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            aria-label={`Remove ${summaryOf(type, item)}`}
            className={
              'flex size-11 shrink-0 items-center justify-center rounded-sm ' +
              'text-muted-foreground outline-none hover:text-destructive ' +
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
            }
          >
            <Trash2 aria-hidden="true" className="size-5" />
          </button>
        </div>

        {/* Remove confirm (UI-SPEC Copywriting "Remove this {item}?"). Inline
            destructive confirm — default focus on the safe "Keep" action. */}
        {confirmRemove ? (
          <div
            role="alertdialog"
            aria-label={`Remove this ${noun}?`}
            className="border-t border-border bg-destructive-bg px-4 py-3"
          >
            <p className="text-sm font-semibold text-foreground">
              Remove this {noun}?
            </p>
            <p className="mt-1 text-[13px] leading-tight text-muted-foreground">
              This will delete it from your portfolio. This can’t be undone after
              you save.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setConfirmRemove(false);
                  onRemove(item.id);
                }}
                disabled={saving}
                className="w-auto bg-destructive hover:bg-destructive"
              >
                Remove
              </Button>
              <Button
                type="button"
                variant="ghost"
                autoFocus
                onClick={() => setConfirmRemove(false)}
                className="w-auto"
              >
                Keep
              </Button>
            </div>
          </div>
        ) : null}

        {/* Expanded fields (per-type). Collapsed = summary only. */}
        {expanded && !confirmRemove ? (
          <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
            {type === 'projects' ? (
              <>
                <Input
                  label="Title"
                  value={str(item.title)}
                  onChange={(e) =>
                    onPatch(item.id, {
                      title: e.target.value,
                      slug: deriveSlug(e.target.value, String(item.slug ?? item.id)),
                    })
                  }
                />
                <Textarea
                  label="Description"
                  value={str(item.description)}
                  maxLength={DESCRIPTION_MAX}
                  onChange={(e) => onPatch(item.id, { description: e.target.value })}
                  trailing={
                    <CharCounter value={str(item.description)} max={DESCRIPTION_MAX} />
                  }
                />
                {/* Dev field — OPTIONAL (the schema allows an empty tech_stack). */}
                <ChipInput
                  label="Tech stack"
                  values={Array.isArray(item.tech_stack) ? (item.tech_stack as string[]) : []}
                  onChange={(next) => onPatch(item.id, { tech_stack: next })}
                />
                <UrlInput
                  label="Live URL"
                  value={str(item.live_url)}
                  onValueChange={(v) => onPatch(item.id, { live_url: v })}
                />
                {/* Dev field — OPTIONAL repo link. */}
                <UrlInput
                  label="Repository URL"
                  value={str(item.repo_url)}
                  onValueChange={(v) => onPatch(item.id, { repo_url: v })}
                />
              </>
            ) : null}

            {type === 'experience' ? (
              <>
                <Input
                  label="Role"
                  value={str(item.role)}
                  onChange={(e) => onPatch(item.id, { role: e.target.value })}
                />
                <Input
                  label="Company"
                  value={str(item.company)}
                  onChange={(e) => onPatch(item.id, { company: e.target.value })}
                />
                <div className="flex gap-4">
                  <Input
                    label="Start (YYYY-MM)"
                    placeholder="2024-01"
                    value={str(item.start_date)}
                    onChange={(e) => onPatch(item.id, { start_date: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    label="End (YYYY-MM or present)"
                    placeholder="present"
                    value={str(item.end_date)}
                    onChange={(e) => onPatch(item.id, { end_date: e.target.value })}
                    className="flex-1"
                  />
                </div>
                <Textarea
                  label="Description"
                  value={str(item.description)}
                  maxLength={DESCRIPTION_MAX}
                  onChange={(e) => onPatch(item.id, { description: e.target.value })}
                  trailing={
                    <CharCounter value={str(item.description)} max={DESCRIPTION_MAX} />
                  }
                />
              </>
            ) : null}

            {type === 'testimonials' ? (
              <>
                <Input
                  label="Name"
                  value={str(item.name)}
                  onChange={(e) => onPatch(item.id, { name: e.target.value })}
                />
                <Input
                  label="Company"
                  value={str(item.company)}
                  onChange={(e) => onPatch(item.id, { company: e.target.value })}
                />
                <Textarea
                  label="Quote"
                  value={str(item.quote)}
                  onChange={(e) => onPatch(item.id, { quote: e.target.value })}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// AddItemCard — the dashed-border "Add {noun}" affordance
// ---------------------------------------------------------------------------

interface AddItemCardProps {
  type: ItemSectionType;
  /** Whether the section is at the 20-item cap (disables the add affordance). */
  atMax: boolean;
  disabled?: boolean;
  onAdd: () => void;
}

/**
 * A full-width dashed-border button that mints a fresh blank item (handled by the
 * parent `ItemManager.add`) in an expanded, focused state ready to fill.
 */
export function AddItemCard({ type, atMax, disabled, onAdd }: AddItemCardProps) {
  const { addLabel } = ITEM_CONFIG[type];

  if (atMax) {
    return (
      <p className="text-[13px] leading-tight text-muted-foreground">
        You’ve added the maximum of {ITEMS_MAX} items.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className={
        'flex min-h-11 w-full items-center justify-center gap-2 rounded-md ' +
        'border-[1.5px] border-dashed border-border-strong bg-transparent ' +
        'px-4 py-3 text-sm font-semibold text-brand outline-none transition-colors ' +
        'hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 ' +
        'focus-visible:outline-ring disabled:cursor-not-allowed disabled:text-muted-foreground ' +
        'motion-reduce:transition-none'
      }
    >
      <Plus aria-hidden="true" className="size-4" />
      {addLabel}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ItemManager — the DndContext + the add/remove/reorder/edit → section save
// ---------------------------------------------------------------------------

interface ItemManagerProps {
  type: ItemSectionType;
  sectionId: string;
  /** The section's current full content (the source of truth from TanStack). */
  initialContent: Record<string, unknown>;
  /** The owner's username, passed so the revalidate needs no extra round-trip. */
  username?: string;
}

/**
 * The item manager that owns the items array + the dnd-kit `DndContext` and turns
 * EVERY item operation into a SECTION CONTENT WRITE through `saveSectionAction`
 * (RESEARCH Pitfall 7 — mutate `content.items`, re-validate the WHOLE content, save).
 * Reorder is optimistic (the only optimistic item op); add/remove/edit are not.
 */
export function ItemManager({
  type,
  sectionId,
  initialContent,
  username,
}: ItemManagerProps) {
  const cfg = ITEM_CONFIG[type];

  const initialItems: EditorItem[] = Array.isArray(initialContent.items)
    ? (initialContent.items as EditorItem[])
    : [];

  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newItemId, setNewItemId] = useState<string | null>(null);

  /**
   * Persist a new items array as a SECTION CONTENT WRITE (Pitfall 7): rebuild the
   * WHOLE content with the mutated items array, then `saveSectionAction` re-parses
   * it via `validateSectionContent` server-side and revalidates the public page.
   * Returns whether the save succeeded so the caller can roll back optimism.
   */
  const persist = useCallback(
    async (nextItems: EditorItem[]): Promise<boolean> => {
      setSaving(true);
      setError(null);
      try {
        const content = { ...initialContent, items: nextItems };
        const result = await saveSectionAction({ sectionId, type, content, username });
        if (!result.ok) {
          setError(result.error ?? SAVE_ERROR);
          return false;
        }
        return true;
      } catch {
        setError(SAVE_ERROR);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [initialContent, sectionId, type, username],
  );

  /** Add a fresh blank item (expanded), then persist. */
  async function add() {
    if (items.length >= ITEMS_MAX) return;
    const blank = cfg.blank();
    const next = [...items, blank];
    setItems(next);
    setNewItemId(blank.id);
    await persist(next);
  }

  /** Apply a partial field change to one item, then persist (debounce-free; the
   *  parent SectionForm Save is the batch path — this keeps each card honest). */
  async function patch(id: string, p: Partial<EditorItem>) {
    const next = items.map((it) => (it.id === id ? { ...it, ...p } : it));
    setItems(next);
    await persist(next);
  }

  /** Remove an item, then persist. */
  async function remove(id: string) {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    await persist(next);
  }

  // Reorder is OPTIMISTIC (SHARED-C, the only optimistic item op): flip the local
  // order instantly, persist, roll back on failure + announce.
  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = items.map((it) => it.id);
    const next = arrayMove(
      items,
      ids.indexOf(active.id as string),
      ids.indexOf(over.id as string),
    );
    const previous = items;
    setItems(next); // optimistic
    void persist(next).then((ok) => {
      if (!ok) {
        setItems(previous); // roll back to the truth (optimistic UI honesty)
        setError(REORDER_ERROR);
      }
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = items.map((it) => it.id);

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${summaryFor(items, type, active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${summaryFor(items, type, active.id)} moved to position ${positionOf(ids, over.id)} of ${ids.length}.`
        : `${summaryFor(items, type, active.id)} is no longer over a drop position.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${summaryFor(items, type, active.id)} dropped at position ${positionOf(ids, over.id)} of ${ids.length}.`
        : `${summaryFor(items, type, active.id)} dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${summaryFor(items, type, active.id)} returned to its position.`,
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert variant="error">{error}</Alert> : null}

      {items.length === 0 ? (
        <p className="text-[13px] leading-tight text-muted-foreground">
          {cfg.emptyLine}
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{ announcements }}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  type={type}
                  item={item}
                  startExpanded={item.id === newItemId}
                  saving={saving}
                  onPatch={patch}
                  onRemove={remove}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <AddItemCard
        type={type}
        atMax={items.length >= ITEMS_MAX}
        disabled={saving}
        onAdd={add}
      />
    </div>
  );
}

/** Resolve an item's summary from a dnd-kit id (announcement helper). */
function summaryFor(
  items: EditorItem[],
  type: ItemSectionType,
  id: string | number,
): string {
  const it = items.find((i) => i.id === id);
  return it ? summaryOf(type, it) : 'item';
}

/** 1-based position of an id in the ordered list (announcement helper). */
function positionOf(ids: string[], id: string | number): number {
  return ids.indexOf(id as string) + 1;
}
