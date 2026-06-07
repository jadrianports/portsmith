'use client';

/**
 * SkillsNestedManager (13.1-05 / D-11 — UI-SPEC §5) — the two-level skills editor
 * that SUPERSEDES the narrow `skills-form.tsx` (which only edited the per-item
 * `level`). This is a real two-level manager: GROUPS (add / rename / reorder, ≤6)
 * each containing SKILLS (add / edit / remove / reorder, ≤40/group), with each skill
 * carrying `name` (req) + `icon` (opt) + `tier` (SegmentedControl) + `level` (0–100
 * number Input). The `level` field ROUND-TRIPS losslessly (the edgerunner
 * animated-bars data, Phase-13 D-09) — that is why the builder preserves it.
 *
 * CLASSIC dnd-kit (CLAUDE.md / RESEARCH "do NOT use @dnd-kit/react"): the EXACT
 * `useSortable` + `KeyboardSensor` + `sortableKeyboardCoordinates` + `announcements`
 * contract `item-card.tsx` / `section-list-row.tsx` ship, nested at TWO levels.
 *
 * NAMESPACED ids (RESEARCH Pattern 2): a group's sortable id is `group:${gid}` and a
 * skill's is `item:${gid}:${iid}` — namespacing prevents a group id from colliding
 * with a skill id. The OUTER `DndContext`/`SortableContext` sorts groups; one INNER
 * `DndContext`/`SortableContext` PER GROUP sorts that group's skills (RESEARCH
 * recommends one DndContext per level for keyboard-scope isolation + per-level
 * announcements). A skill drop whose target is in a DIFFERENT group is REJECTED —
 * within-group reorder only (RESEARCH Open Q5; cross-group moves are out of scope).
 *
 * Each `DndContext` carries a STABLE explicit id scoped to the section (+ the group
 * id for the inner contexts) so `aria-describedby` is hydration-stable (the
 * `item-card.tsx:728` precedent — bypasses dnd-kit's module-global counter):
 *   outer: `skills-groups-dnd-${sectionId}`
 *   inner: `skills-items-dnd-${sectionId}-${gid}`
 *
 * CLIENT-ONLY ids: `skillsContentSchema` persists NO `id` on a group or a skill
 * (groups are `{ label, items }`, items are `{ name, icon?, tier?, level? }`). So the
 * editor mints a CLIENT-ONLY `__id` (nanoid) per group + per skill, held in local
 * state ONLY for dnd-kit/React keys, and STRIPS it in `buildSkillsContent` before the
 * write (the persisted JSONB never carries `__id`).
 *
 * WHOLE-SECTION WRITE (Pitfall 7 — there is no skills item table): every group/skill
 * op rebuilds the WHOLE `{ heading, groups: [...] }` content and routes through the
 * UNCHANGED `saveSectionAction`. Field edits debounce (the Plan-03 `scheduleSave`);
 * group/skill add / remove / reorder are IMMEDIATE (`immediateSave`).
 *
 * BUNDLE RULE (CLAUDE.md / D-25 — LOAD-BEARING): this `'use client'` island MUST NOT
 * import the `@/lib/validations` barrel or `templates/registry.ts` — both drag Zod
 * onto the public First Load JS bundle. The maxes (6 groups / 40 skills / 0–100
 * level) are inline UX LITERALS; the SERVER re-parse inside `saveSectionAction` →
 * `validateSectionContent` is the authoritative gate.
 *
 * Two-layer identity (SHARED-E): chrome tokens ONLY (Evergreen/Copper). No inline
 * hex, no template-token reach. Reduced-motion-safe.
 *
 * Source: the classic dnd-kit + a11y contract from `item-card.tsx` /
 * `section-list-row.tsx`; the SegmentedControl tier control + the level number Input
 * idiom + the bundle-rule discipline + the pure-helper precedent from
 * `skills-form.tsx`; the shared save hook from `use-debounced-section-save.ts`.
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
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useCallback, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';

import { SegmentedControl } from './segmented-control';
import { useDebouncedSectionSave } from './use-debounced-section-save';

// ---------------------------------------------------------------------------
// UX-only LITERALS — mirror skillsContentSchema's bounds (sections.ts). Client UX
// only; the SERVER re-parse is the gate (the Zod barrel is NOT imported — D-25).
// ---------------------------------------------------------------------------

/** `skillsContentSchema.groups.max(6)`. */
const GROUPS_MAX = 6;
/** `skillGroupSchema.items.max(40)`. */
const SKILLS_PER_GROUP_MAX = 40;
/** `skillGroupSchema.label` / `skillItemSchema.name` max(60). */
const LABEL_MAX = 60;
const NAME_MAX = 60;
/** `skillItemSchema.level` — int 0–100 (the edgerunner animated-bars range). */
const LEVEL_MIN = 0;
const LEVEL_MAX = 100;
const LEVEL_STEP = 1;

/** The skill `tier` closed enum (`skillItemSchema.tier`) — the SegmentedControl set. */
type SkillTier = 'core' | 'proficient' | 'learning';
const TIER_OPTIONS: { value: SkillTier; label: string }[] = [
  { value: 'core', label: 'Core' },
  { value: 'proficient', label: 'Proficient' },
  { value: 'learning', label: 'Learning' },
];

const SAVE_ERROR = 'We couldn’t save your changes. Please try again.';
const REORDER_ERROR =
  'We couldn’t save the new order — it’s been put back. Please try again.';

// ---------------------------------------------------------------------------
// Editor-state model (client `__id` for keys; STRIPPED before the write)
// ---------------------------------------------------------------------------

/** One skill in the editor's working state. `__id` is CLIENT-ONLY (dnd-kit/React key). */
export interface SkillsEditorItem {
  /** Client-only stable key (nanoid) — STRIPPED by `buildSkillsContent`. */
  __id: string;
  name: string;
  icon?: string;
  tier?: SkillTier;
  level?: number;
}

/** One group in the editor's working state. `__id` is CLIENT-ONLY. */
export interface SkillsEditorGroup {
  /** Client-only stable key (nanoid) — STRIPPED by `buildSkillsContent`. */
  __id: string;
  label: string;
  items: SkillsEditorItem[];
}

/** The persisted (schema-shaped) skill — NO `__id` (matches `skillItemSchema`). */
interface PersistedSkill {
  name: string;
  icon?: string;
  tier?: SkillTier;
  level?: number;
}

/** The persisted (schema-shaped) group — NO `__id` (matches `skillGroupSchema`). */
interface PersistedGroup {
  label: string;
  items: PersistedSkill[];
}

/** The persisted skills content (matches `skillsContentSchema`). */
export interface SkillsContentShape {
  heading: string;
  groups: PersistedGroup[];
}

// ---------------------------------------------------------------------------
// PURE builder (exported, render-free, node-unit-testable — the skills-form precedent)
// ---------------------------------------------------------------------------

/**
 * PURE: rebuild the WHOLE `{ heading, groups: [...] }` skills content from the
 * editor's working state (Pitfall 7). The client-only `__id` keys are STRIPPED, and
 * absent optionals (`icon`/`tier`/`level`) are OMITTED so the persisted JSONB matches
 * `skillsContentSchema` exactly. `level` (and `tier`/`icon`) ROUND-TRIP faithfully —
 * the builder does NOT clamp/validate (it carries what the user typed, incl. an
 * out-of-range value), so the SERVER re-parse stays the sole authority.
 *
 * Exported (no DOM needed) so the save payload is unit-testable in the `node` vitest
 * project (the storage-meter / skills-form precedent).
 */
export function buildSkillsContent(
  heading: string,
  groups: SkillsEditorGroup[],
): SkillsContentShape {
  return {
    heading,
    groups: groups.map((group) => ({
      label: group.label,
      items: group.items.map((item) => {
        const skill: PersistedSkill = { name: item.name };
        if (item.icon !== undefined && item.icon !== '') skill.icon = item.icon;
        if (item.tier !== undefined) skill.tier = item.tier;
        if (item.level !== undefined) skill.level = item.level;
        return skill;
      }),
    })),
  };
}

/** Read the initial editor groups from the section's persisted content (mint `__id`s). */
function toEditorGroups(initialContent: Record<string, unknown>): SkillsEditorGroup[] {
  const raw = Array.isArray(initialContent.groups) ? initialContent.groups : [];
  return raw.map((g) => {
    const group = (g ?? {}) as Record<string, unknown>;
    const items = Array.isArray(group.items) ? group.items : [];
    return {
      __id: nanoid(),
      label: typeof group.label === 'string' ? group.label : '',
      items: items.map((i) => {
        const it = (i ?? {}) as Record<string, unknown>;
        const skill: SkillsEditorItem = {
          __id: nanoid(),
          name: typeof it.name === 'string' ? it.name : '',
        };
        if (typeof it.icon === 'string') skill.icon = it.icon;
        if (it.tier === 'core' || it.tier === 'proficient' || it.tier === 'learning') {
          skill.tier = it.tier;
        }
        if (typeof it.level === 'number') skill.level = it.level;
        return skill;
      }),
    };
  });
}

/** Namespaced dnd-kit ids (RESEARCH Pattern 2 — prevent group/skill id collision). */
const groupSortId = (gid: string) => `group:${gid}`;
const itemSortId = (gid: string, iid: string) => `item:${gid}:${iid}`;
/** The group id encoded inside a skill's namespaced sortable id (`item:<gid>:<iid>`). */
function groupIdOfItemSortId(sortId: string): string | null {
  const parts = sortId.split(':');
  return parts[0] === 'item' && parts.length === 3 ? parts[1] : null;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

// ---------------------------------------------------------------------------
// SkillRow — one sortable skill within a group (inner level)
// ---------------------------------------------------------------------------

interface SkillRowProps {
  gid: string;
  item: SkillsEditorItem;
  disabled: boolean;
  onPatch: (iid: string, patch: Partial<SkillsEditorItem>) => void;
  onRemove: (iid: string) => void;
}

function SkillRow({ gid, item, disabled, onPatch, onRemove }: SkillRowProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemSortId(gid, item.__id) });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const tier: SkillTier = item.tier ?? 'core';
  const levelValue = item.level === undefined ? '' : String(item.level);
  const skillLabel = str(item.name) || 'Skill';

  return (
    <li ref={setNodeRef} style={style} className="list-none">
      <div
        className={
          'rounded-md border border-border bg-surface ' +
          (isDragging ? 'z-10 shadow-card motion-reduce:shadow-none' : '')
        }
      >
        <div className="flex items-center gap-2 px-2 py-2">
          {/* 44px drag handle — the activator (keyboard: Space lifts → arrows → Space). */}
          <button
            type="button"
            ref={setActivatorNodeRef}
            aria-label={`Reorder ${skillLabel} (use arrow keys after pressing space)`}
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

          <span className="flex-1 truncate text-sm font-semibold text-foreground">
            {skillLabel}
          </span>

          {/* 44px remove button → opens the inline destructive confirm. */}
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            aria-label={`Remove ${skillLabel}`}
            className={
              'flex size-11 shrink-0 items-center justify-center rounded-sm ' +
              'text-muted-foreground outline-none hover:text-destructive ' +
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
            }
          >
            <Trash2 aria-hidden="true" className="size-5" />
          </button>
        </div>

        {confirmRemove ? (
          <div
            role="alertdialog"
            aria-label="Remove this skill?"
            className="border-t border-border bg-destructive-bg px-4 py-3"
          >
            <p className="text-sm font-semibold text-foreground">Remove this skill?</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmRemove(false);
                  onRemove(item.__id);
                }}
                disabled={disabled}
                className={
                  'inline-flex min-h-11 items-center justify-center rounded-md bg-destructive ' +
                  'px-4 text-sm font-semibold text-brand-foreground outline-none ' +
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
                  'disabled:cursor-not-allowed'
                }
              >
                Remove
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmRemove(false)}
                className={
                  'inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm ' +
                  'font-semibold text-foreground outline-none hover:bg-surface-muted ' +
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                }
              >
                Keep
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
            <Input
              label="Skill (required)"
              value={str(item.name)}
              maxLength={NAME_MAX}
              disabled={disabled}
              onChange={(e) => onPatch(item.__id, { name: e.target.value })}
            />
            <Input
              label="Icon name (optional)"
              value={str(item.icon)}
              maxLength={NAME_MAX}
              disabled={disabled}
              onChange={(e) => onPatch(item.__id, { icon: e.target.value })}
            />
            <SegmentedControl<SkillTier>
              label="Tier"
              options={TIER_OPTIONS}
              value={tier}
              disabled={disabled}
              onChange={(t) => onPatch(item.__id, { tier: t })}
            />
            <Input
              type="number"
              inputMode="numeric"
              min={LEVEL_MIN}
              max={LEVEL_MAX}
              step={LEVEL_STEP}
              label="Proficiency (0–100)"
              value={levelValue}
              disabled={disabled}
              onChange={(e) => {
                const v = e.target.value;
                if (v.trim() === '') {
                  onPatch(item.__id, { level: undefined });
                  return;
                }
                const n = Number(v);
                onPatch(item.__id, { level: Number.isFinite(n) ? n : undefined });
              }}
            />
          </div>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// GroupCard — one sortable group (outer level) + its inner skills SortableContext
// ---------------------------------------------------------------------------

interface GroupCardProps {
  sectionId: string;
  group: SkillsEditorGroup;
  disabled: boolean;
  onRenameGroup: (gid: string, label: string) => void;
  onRemoveGroup: (gid: string) => void;
  onAddSkill: (gid: string) => void;
  onPatchSkill: (gid: string, iid: string, patch: Partial<SkillsEditorItem>) => void;
  onRemoveSkill: (gid: string, iid: string) => void;
  onReorderSkills: (gid: string, activeSortId: string, overSortId: string) => void;
}

function GroupCard({
  sectionId,
  group,
  disabled,
  onRenameGroup,
  onRemoveGroup,
  onAddSkill,
  onPatchSkill,
  onRemoveSkill,
  onReorderSkills,
}: GroupCardProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: groupSortId(group.__id) });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // The INNER (skills) sensors + announcements — one per group, keyboard-scope
  // isolated from the outer group sensors (RESEARCH Pattern 2).
  const innerSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const itemSortIds = group.items.map((i) => itemSortId(group.__id, i.__id));
  const groupLabel = str(group.label) || 'Skills';

  const innerAnnouncements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${skillNameOfSortId(group, active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${skillNameOfSortId(group, active.id)} moved to position ${itemPositionOf(itemSortIds, over.id)} of ${itemSortIds.length} in ${groupLabel}.`
        : `${skillNameOfSortId(group, active.id)} is no longer over a drop position.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${skillNameOfSortId(group, active.id)} dropped at position ${itemPositionOf(itemSortIds, over.id)} of ${itemSortIds.length} in ${groupLabel}.`
        : `${skillNameOfSortId(group, active.id)} dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${skillNameOfSortId(group, active.id)} returned to its position in ${groupLabel}.`,
  };

  function handleInnerDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    // Within-group reorder only (RESEARCH Open Q5): reject a drop whose target group
    // prefix differs from the active skill's group.
    const a = String(active.id);
    const o = String(over.id);
    if (groupIdOfItemSortId(a) !== group.__id || groupIdOfItemSortId(o) !== group.__id) {
      return;
    }
    onReorderSkills(group.__id, a, o);
  }

  const atSkillMax = group.items.length >= SKILLS_PER_GROUP_MAX;

  return (
    <li ref={setNodeRef} style={style} className="list-none">
      <div
        className={
          'rounded-md border border-border bg-surface ' +
          (isDragging ? 'z-10 shadow-card motion-reduce:shadow-none' : '')
        }
      >
        {/* Group header: drag handle · rename Input · remove-group. */}
        <div className="flex items-center gap-2 px-2 py-2">
          <button
            type="button"
            ref={setActivatorNodeRef}
            aria-label={`Reorder ${groupLabel} group (use arrow keys after pressing space)`}
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

          <Input
            label={`Rename group ${groupLabel}`}
            value={str(group.label)}
            maxLength={LABEL_MAX}
            disabled={disabled}
            onChange={(e) => onRenameGroup(group.__id, e.target.value)}
            className="flex-1 [&>label]:sr-only"
          />

          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            aria-label={`Remove ${groupLabel} group`}
            className={
              'flex size-11 shrink-0 items-center justify-center rounded-sm ' +
              'text-muted-foreground outline-none hover:text-destructive ' +
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
            }
          >
            <Trash2 aria-hidden="true" className="size-5" />
          </button>
        </div>

        {confirmRemove ? (
          <div
            role="alertdialog"
            aria-label="Remove this group?"
            className="border-t border-border bg-destructive-bg px-4 py-3"
          >
            <p className="text-sm font-semibold text-foreground">Remove this group?</p>
            <p className="mt-1 text-[13px] leading-tight text-muted-foreground">
              This deletes the group and every skill in it. This can’t be undone after
              you save.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmRemove(false);
                  onRemoveGroup(group.__id);
                }}
                disabled={disabled}
                className={
                  'inline-flex min-h-11 items-center justify-center rounded-md bg-destructive ' +
                  'px-4 text-sm font-semibold text-brand-foreground outline-none ' +
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
                  'disabled:cursor-not-allowed'
                }
              >
                Remove group
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmRemove(false)}
                className={
                  'inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm ' +
                  'font-semibold text-foreground outline-none hover:bg-surface-muted ' +
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                }
              >
                Keep
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 border-t border-border px-4 py-4">
            {group.items.length === 0 ? (
              <p className="text-[13px] leading-tight text-muted-foreground">
                No skills in this group yet.
              </p>
            ) : (
              <DndContext
                // Stable explicit id scoped to section + group (hydration-stable
                // aria-describedby — the item-card.tsx:728 precedent).
                id={`skills-items-dnd-${sectionId}-${group.__id}`}
                sensors={innerSensors}
                collisionDetection={closestCenter}
                accessibility={{ announcements: innerAnnouncements }}
                onDragEnd={handleInnerDragEnd}
              >
                <SortableContext items={itemSortIds} strategy={verticalListSortingStrategy}>
                  <ul className="flex flex-col gap-3">
                    {group.items.map((item) => (
                      <SkillRow
                        key={item.__id}
                        gid={group.__id}
                        item={item}
                        disabled={disabled}
                        onPatch={(iid, patch) => onPatchSkill(group.__id, iid, patch)}
                        onRemove={(iid) => onRemoveSkill(group.__id, iid)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}

            {atSkillMax ? (
              <p className="text-[13px] leading-tight text-muted-foreground">
                You’ve added the maximum of {SKILLS_PER_GROUP_MAX} skills.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => onAddSkill(group.__id)}
                disabled={disabled}
                className={
                  'flex min-h-11 w-full items-center justify-center gap-2 rounded-md ' +
                  'border-[1.5px] border-dashed border-border-strong bg-transparent ' +
                  'px-4 py-2 text-sm font-semibold text-brand outline-none transition-colors ' +
                  'hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 ' +
                  'focus-visible:outline-ring disabled:cursor-not-allowed disabled:text-muted-foreground ' +
                  'motion-reduce:transition-none'
                }
              >
                <Plus aria-hidden="true" className="size-4" />
                Add skill
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Resolve a skill's name from its namespaced sortable id (inner announcement helper). */
function skillNameOfSortId(group: SkillsEditorGroup, sortId: string | number): string {
  const iid = String(sortId).split(':')[2];
  const it = group.items.find((i) => i.__id === iid);
  return it ? str(it.name) || 'skill' : 'skill';
}

/** 1-based position of a namespaced item sort id (inner announcement helper). */
function itemPositionOf(itemSortIds: string[], sortId: string | number): number {
  return itemSortIds.indexOf(String(sortId)) + 1;
}

// ---------------------------------------------------------------------------
// SkillsNestedManager — the outer (group) DndContext + the whole-section save
// ---------------------------------------------------------------------------

export interface SkillsNestedManagerProps {
  sectionId: string;
  /** The section's current content (from TanStack Query — the source of truth). */
  initialContent: Record<string, unknown>;
  /** The owner's username, passed so the revalidate needs no extra round-trip. */
  username?: string;
}

export function SkillsNestedManager({
  sectionId,
  initialContent,
  username,
}: SkillsNestedManagerProps) {
  const [heading, setHeading] = useState<string>(() => str(initialContent.heading));
  const [groups, setGroups] = useState<SkillsEditorGroup[]>(() =>
    toEditorGroups(initialContent),
  );
  const [reorderError, setReorderError] = useState<string | null>(null);

  // D-20 shared save hook: field edits debounce (`scheduleSave`); group/skill add /
  // remove / reorder stay IMMEDIATE (`immediateSave`).
  const { state, scheduleSave, immediateSave } = useDebouncedSectionSave({
    sectionId,
    type: 'skills',
    username,
  });

  const saving = state === 'saving';
  const error = reorderError ?? (state === 'error' ? SAVE_ERROR : null);

  /** Build the WHOLE next content from the editor working state (Pitfall 7). */
  const contentOf = useCallback(
    (nextHeading: string, nextGroups: SkillsEditorGroup[]) =>
      buildSkillsContent(nextHeading, nextGroups) as unknown as Record<string, unknown>,
    [],
  );

  // ── Heading (field edit → debounced save) ──
  function onHeadingChange(value: string) {
    setHeading(value);
    setReorderError(null);
    scheduleSave(contentOf(value, groups));
  }

  // ── Groups: add / rename / remove (rename = field-edit debounce; add/remove immediate) ──
  function addGroup() {
    if (groups.length >= GROUPS_MAX) return;
    const next = [...groups, { __id: nanoid(), label: '', items: [] }];
    setGroups(next);
    setReorderError(null);
    void immediateSave(contentOf(heading, next));
  }

  function renameGroup(gid: string, label: string) {
    const next = groups.map((g) => (g.__id === gid ? { ...g, label } : g));
    setGroups(next);
    setReorderError(null);
    scheduleSave(contentOf(heading, next));
  }

  function removeGroup(gid: string) {
    const next = groups.filter((g) => g.__id !== gid);
    setGroups(next);
    setReorderError(null);
    void immediateSave(contentOf(heading, next));
  }

  // ── Skills within a group: add / patch / remove ──
  function addSkill(gid: string) {
    const next = groups.map((g) =>
      g.__id === gid && g.items.length < SKILLS_PER_GROUP_MAX
        ? { ...g, items: [...g.items, { __id: nanoid(), name: '' }] }
        : g,
    );
    setGroups(next);
    setReorderError(null);
    void immediateSave(contentOf(heading, next));
  }

  function patchSkill(gid: string, iid: string, patch: Partial<SkillsEditorItem>) {
    const next = groups.map((g) =>
      g.__id === gid
        ? {
            ...g,
            items: g.items.map((i) => (i.__id === iid ? { ...i, ...patch } : i)),
          }
        : g,
    );
    setGroups(next);
    setReorderError(null);
    scheduleSave(contentOf(heading, next));
  }

  function removeSkill(gid: string, iid: string) {
    const next = groups.map((g) =>
      g.__id === gid ? { ...g, items: g.items.filter((i) => i.__id !== iid) } : g,
    );
    setGroups(next);
    setReorderError(null);
    void immediateSave(contentOf(heading, next));
  }

  // ── Skills reorder WITHIN a group (optimistic) ──
  function reorderSkills(gid: string, activeSortId: string, overSortId: string) {
    const group = groups.find((g) => g.__id === gid);
    if (!group) return;
    const ids = group.items.map((i) => itemSortId(gid, i.__id));
    const from = ids.indexOf(activeSortId);
    const to = ids.indexOf(overSortId);
    if (from < 0 || to < 0) return;

    const previous = groups;
    const nextItems = arrayMove(group.items, from, to);
    const next = groups.map((g) => (g.__id === gid ? { ...g, items: nextItems } : g));
    setGroups(next); // optimistic
    setReorderError(null);
    void immediateSave(contentOf(heading, next)).then((result) => {
      if (result.ok) return;
      // A real failure → roll back to the truth (the skip-invalid case cannot apply
      // to a within-group skill reorder, which preserves names; a failure is real).
      setGroups(previous);
      setReorderError(REORDER_ERROR);
    });
  }

  // ── Groups reorder (outer, optimistic) ──
  const outerSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const groupSortIds = groups.map((g) => groupSortId(g.__id));

  const outerAnnouncements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${groupLabelOfSortId(groups, active.id)} group.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${groupLabelOfSortId(groups, active.id)} group moved to position ${groupPositionOf(groupSortIds, over.id)} of ${groupSortIds.length}.`
        : `${groupLabelOfSortId(groups, active.id)} group is no longer over a drop position.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${groupLabelOfSortId(groups, active.id)} group dropped at position ${groupPositionOf(groupSortIds, over.id)} of ${groupSortIds.length}.`
        : `${groupLabelOfSortId(groups, active.id)} group dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${groupLabelOfSortId(groups, active.id)} group returned to its position.`,
  };

  function handleOuterDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const a = String(active.id);
    const o = String(over.id);
    // Only group:-prefixed ids participate in the outer context (within-group skill
    // drags are handled by the inner contexts), but guard defensively.
    if (!a.startsWith('group:') || !o.startsWith('group:')) return;
    const from = groupSortIds.indexOf(a);
    const to = groupSortIds.indexOf(o);
    if (from < 0 || to < 0) return;

    const previous = groups;
    const next = arrayMove(groups, from, to);
    setGroups(next); // optimistic
    setReorderError(null);
    void immediateSave(contentOf(heading, next)).then((result) => {
      if (result.ok) return;
      setGroups(previous);
      setReorderError(REORDER_ERROR);
    });
  }

  const atGroupMax = groups.length >= GROUPS_MAX;

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <Input
        label="Heading"
        value={heading}
        maxLength={100}
        disabled={saving}
        onChange={(e) => onHeadingChange(e.target.value)}
      />

      {groups.length === 0 ? (
        <p className="text-[13px] leading-tight text-muted-foreground">
          No skill groups yet — add your first one.
        </p>
      ) : (
        <DndContext
          // Stable explicit id scoped to the section (hydration-stable
          // aria-describedby — the item-card.tsx:728 precedent).
          id={`skills-groups-dnd-${sectionId}`}
          sensors={outerSensors}
          collisionDetection={closestCenter}
          accessibility={{ announcements: outerAnnouncements }}
          onDragEnd={handleOuterDragEnd}
        >
          <SortableContext items={groupSortIds} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-6">
              {groups.map((group) => (
                <GroupCard
                  key={group.__id}
                  sectionId={sectionId}
                  group={group}
                  disabled={saving}
                  onRenameGroup={renameGroup}
                  onRemoveGroup={removeGroup}
                  onAddSkill={addSkill}
                  onPatchSkill={patchSkill}
                  onRemoveSkill={removeSkill}
                  onReorderSkills={reorderSkills}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {atGroupMax ? (
        <p className="text-[13px] leading-tight text-muted-foreground">
          You’ve added the maximum of {GROUPS_MAX} groups.
        </p>
      ) : (
        <button
          type="button"
          onClick={addGroup}
          disabled={saving}
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
          Add group
        </button>
      )}
    </div>
  );
}

/** Resolve a group's label from its namespaced sortable id (outer announcement helper). */
function groupLabelOfSortId(groups: SkillsEditorGroup[], sortId: string | number): string {
  const gid = String(sortId).split(':')[1];
  const g = groups.find((x) => x.__id === gid);
  return g ? str(g.label) || 'group' : 'group';
}

/** 1-based position of a namespaced group sort id (outer announcement helper). */
function groupPositionOf(groupSortIds: string[], sortId: string | number): number {
  return groupSortIds.indexOf(String(sortId)) + 1;
}
