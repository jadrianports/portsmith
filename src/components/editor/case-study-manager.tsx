'use client';

/**
 * CaseStudyManager (35-02 / GAL-02 — v2.8 "Show the Work") — the "tell one project as a
 * story" editor: an OUTER reorderable list of case-study item cards (cap 12). Each card
 * carries a REQUIRED `title`, optional `role`/`client`/`year` meta, the three optional
 * fixed-label narrative blocks Challenge / Process / Outcome (single text blocks, NOT
 * step arrays — D-05), and an INNER image set — its OWN batch GalleryUploader (cap 5)
 * plus a reorderable alt-gated inner image list (D-06).
 *
 * Built on the MoodboardManager / GalleryManager analog: @dnd-kit CLASSIC reorder
 * (`@dnd-kit/core` 6.3.1 — NEVER `@dnd-kit/react`), the shared `useDebouncedSectionSave`
 * hook, and a PURE exported content builder (`buildCaseStudyContent` — render-free,
 * node-unit-testable). Two reorder scopes: the outer items list AND each card's inner
 * image list (independent DndContexts keyed by section/item id).
 *
 * ORPHAN BELT (T-35-ORPHAN / D-09): each item card supplies `persistedUrls` = the SET of
 * THAT item's currently-SAVED image urls so each per-item GalleryUploader frees only its
 * unsaved churn on unmount; persisted deletes are handled by the Plan-01 server
 * delete-diff (case_study NESTED `items[].images[].url` walker).
 *
 * WHOLE-SECTION WRITE (Pitfall 7): every op rebuilds the WHOLE
 * `{ heading?, items: [...] }` content and routes through the UNCHANGED saveSectionAction
 * via the shared debounce (field edits `scheduleSave`; add/remove/reorder `immediateSave`).
 *
 * BUNDLE RULE (CLAUDE.md / D-25): NO `@/lib/validations` barrel import — the caps (12
 * items / 5 images) + the field maxes are inline UX LITERALS; the SERVER re-parse
 * (`caseStudyContentSchema`, incl. the alt + `z.url({protocol})` gate) is the boundary.
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
import { useCallback, useEffect, useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { CharCounter } from '@/components/ui/char-counter';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { GalleryUploader, type GalleryUploadItem } from './gallery-uploader';
import { SaveStatus } from './save-status';
import { useDebouncedSectionSave } from './use-debounced-section-save';

// ---------------------------------------------------------------------------
// UX-only LITERALS — mirror caseStudyContentSchema's bounds (sections.ts). Client UX
// only; the SERVER re-parse is the gate (the Zod barrel is NOT imported — D-25).
// ---------------------------------------------------------------------------

/** `caseStudyContentSchema.items.max(12)` (D-04/D-07 / T-35-DOS). */
const ITEMS_MAX = 12;
/** `caseStudyItemSchema.images.max(5)` (D-06 / T-35-DOS). */
const IMAGES_MAX = 5;
/** `caseStudyContentSchema.heading` max(100). */
const HEADING_MAX = 100;
/** `caseStudyItemSchema.title` max(150). */
const TITLE_MAX = 150;
/** `role`/`client` max(120). */
const META_MAX = 120;
/** `year` max(60). */
const YEAR_MAX = 60;
/** `challenge`/`process`/`outcome` max(2000). */
const BLOCK_MAX = 2000;
/** ~2.2s saved-&-live beat hold (parity with the other managers). */
const SAVED_BEAT_MS = 2200;

const SAVE_ERROR = 'We couldn’t save your changes. Please try again.';
const REORDER_ERROR =
  'We couldn’t save the new order — it’s been put back. Please try again.';
const STORAGE_NUDGE =
  'These images won’t show on your current template — they still count toward your 65 MiB storage.';

const str = (v: unknown) => (typeof v === 'string' ? v : '');

// ---------------------------------------------------------------------------
// Editor-state model
// ---------------------------------------------------------------------------

/** One nested image in a case-study item's working state. All fields PERSISTED. */
export interface CaseStudyEditorImage {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** One case-study item in the editor's working state. `id` is PERSISTED. */
export interface CaseStudyEditorItem {
  id: string;
  title: string;
  role: string;
  client: string;
  year: string;
  challenge: string;
  process: string;
  outcome: string;
  images: CaseStudyEditorImage[];
}

/** The persisted (schema-shaped) nested image — matches `caseStudyImageSchema`. */
interface PersistedImage {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** The persisted (schema-shaped) case-study item — matches `caseStudyItemSchema`. */
interface PersistedItem {
  id: string;
  title: string;
  role?: string;
  client?: string;
  year?: string;
  challenge?: string;
  process?: string;
  outcome?: string;
  images: PersistedImage[];
}

/** The persisted case-study content (matches `caseStudyContentSchema`). */
export interface CaseStudyContentShape {
  heading?: string;
  items: PersistedItem[];
}

// ---------------------------------------------------------------------------
// PURE builder (exported, render-free, node-unit-testable — the moodboard precedent)
// ---------------------------------------------------------------------------

/**
 * PURE: rebuild the WHOLE `{ heading?, items: [...] }` case-study content from the
 * editor's working state (Pitfall 7). The item `id` + `title` + nested image fields are
 * KEPT; the optional meta/narrative blocks are OMITTED when blank (`.optional()`);
 * `heading` is OMITTED when blank.
 *
 * The builder does NOT clamp/validate — the SERVER re-parse (`caseStudyContentSchema`,
 * incl. the alt rule + `z.url({ protocol })` stored-XSS gate) stays the sole authority.
 */
export function buildCaseStudyContent(
  items: CaseStudyEditorItem[],
  heading?: string,
): CaseStudyContentShape {
  const content: CaseStudyContentShape = {
    items: items.map((it) => {
      const out: PersistedItem = {
        id: it.id,
        title: it.title,
        images: it.images.map((img) => ({
          id: img.id,
          url: img.url,
          width: img.width,
          height: img.height,
          alt: img.alt,
        })),
      };
      if (it.role.trim() !== '') out.role = it.role;
      if (it.client.trim() !== '') out.client = it.client;
      if (it.year.trim() !== '') out.year = it.year;
      if (it.challenge.trim() !== '') out.challenge = it.challenge;
      if (it.process.trim() !== '') out.process = it.process;
      if (it.outcome.trim() !== '') out.outcome = it.outcome;
      return out;
    }),
  };
  if (heading !== undefined && heading.trim() !== '') content.heading = heading;
  return content;
}

/** A positive-integer dimension, mirroring `caseStudyImageSchema` (`z.number().int().positive()`). */
function posIntDim(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

/**
 * Read the initial nested images of one item (KEEP/mint ids).
 * WR-02 (35-REVIEW): PRUNE any persisted image whose `url`/dims are not server-valid
 * (blank url, or non-positive-int width/height) rather than fabricating a `0` the schema
 * is guaranteed to reject — a corrupt/legacy row would otherwise silently wedge the whole
 * section against the next save. The SERVER re-parse stays the gate.
 */
function toEditorImages(raw: unknown): CaseStudyEditorImage[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: CaseStudyEditorImage[] = [];
  for (const i of arr) {
    const it = (i ?? {}) as Record<string, unknown>;
    const url = typeof it.url === 'string' ? it.url : '';
    if (url === '' || !posIntDim(it.width) || !posIntDim(it.height)) continue; // corrupt → prune
    out.push({
      id: typeof it.id === 'string' && it.id !== '' ? it.id : nanoid(),
      url,
      width: it.width as number,
      height: it.height as number,
      alt: typeof it.alt === 'string' ? it.alt : '',
    });
  }
  return out;
}

/** Read the initial editor items from the section's persisted content (KEEP/mint ids). */
function toEditorItems(initialContent: Record<string, unknown>): CaseStudyEditorItem[] {
  const raw = Array.isArray(initialContent.items) ? initialContent.items : [];
  return raw.map((i) => {
    const it = (i ?? {}) as Record<string, unknown>;
    return {
      id: typeof it.id === 'string' && it.id !== '' ? it.id : nanoid(),
      title: typeof it.title === 'string' ? it.title : '',
      role: typeof it.role === 'string' ? it.role : '',
      client: typeof it.client === 'string' ? it.client : '',
      year: typeof it.year === 'string' ? it.year : '',
      challenge: typeof it.challenge === 'string' ? it.challenge : '',
      process: typeof it.process === 'string' ? it.process : '',
      outcome: typeof it.outcome === 'string' ? it.outcome : '',
      images: toEditorImages(it.images),
    };
  });
}

/** True if any image (anywhere) has a URL but a blank required alt (skip-vs-fail probe). */
function anyImageMissingAlt(items: CaseStudyEditorItem[]): boolean {
  return items.some((it) =>
    it.images.some((img) => str(img.url).trim() !== '' && str(img.alt).trim() === ''),
  );
}

// ---------------------------------------------------------------------------
// InnerImageCard — one sortable nested image (thumbnail + required alt + remove)
// ---------------------------------------------------------------------------

interface InnerImageCardProps {
  image: CaseStudyEditorImage;
  disabled: boolean;
  onPatch: (id: string, patch: Partial<CaseStudyEditorImage>) => void;
  onRemove: (id: string) => void;
}

function InnerImageCard({ image, disabled, onPatch, onRemove }: InnerImageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const cardLabel = str(image.alt) || 'image';

  return (
    <li ref={setNodeRef} style={style} className="list-none">
      <div
        className={
          'flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-2 ' +
          (isDragging ? 'z-10 shadow-card motion-reduce:shadow-none' : '')
        }
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`Reorder ${cardLabel} (use arrow keys after pressing space)`}
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

        {/* eslint-disable-next-line @next/next/no-img-element — editor-only preview. */}
        <img
          src={image.url}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-sm border border-border object-cover"
        />

        <Input
          label="Alt text"
          value={str(image.alt)}
          placeholder="e.g. Final packaging mockup"
          disabled={disabled}
          onChange={(e) => onPatch(image.id, { alt: e.target.value })}
          className="flex-1"
        />

        <button
          type="button"
          onClick={() => onRemove(image.id)}
          disabled={disabled}
          aria-label={`Remove ${cardLabel}`}
          className={
            'flex size-11 shrink-0 items-center justify-center rounded-sm ' +
            'text-muted-foreground outline-none hover:text-destructive ' +
            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ' +
            'disabled:cursor-not-allowed'
          }
        >
          <Trash2 aria-hidden="true" className="size-5" />
        </button>
      </div>
    </li>
  );
}

function imageLabelOf(images: CaseStudyEditorImage[], id: string | number): string {
  const it = images.find((i) => i.id === id);
  return it ? str(it.alt) || 'image' : 'image';
}
function positionOf(ids: string[], id: string | number): number {
  return ids.indexOf(String(id)) + 1;
}

// ---------------------------------------------------------------------------
// ItemCard — one sortable case-study item (narrative fields + nested image set)
// ---------------------------------------------------------------------------

interface ItemCardProps {
  item: CaseStudyEditorItem;
  disabled: boolean;
  isUnsupported: boolean;
  onPatch: (id: string, patch: Partial<CaseStudyEditorItem>) => void;
  onRemove: (id: string) => void;
  onImagesChange: (
    id: string,
    next: CaseStudyEditorImage[],
    immediate: boolean,
  ) => void;
}

function ItemCard({
  item,
  disabled,
  isUnsupported,
  onPatch,
  onRemove,
  onImagesChange,
}: ItemCardProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cardLabel = str(item.title) || 'Untitled case study';

  // T-35-ORPHAN / D-09: THIS item's currently-saved image urls (mirrored to a ref) so
  // the per-item GalleryUploader frees only its unsaved churn on unmount.
  const persistedUrlsRef = useRef<Set<string>>(
    new Set(item.images.map((i) => i.url).filter((u) => u !== '')),
  );
  useEffect(() => {
    persistedUrlsRef.current = new Set(
      item.images.map((i) => i.url).filter((u) => u !== ''),
    );
  }, [item.images]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const imageIds = item.images.map((i) => i.id);
  const atImageMax = item.images.length >= IMAGES_MAX;

  function onUploaded(uploaded: GalleryUploadItem) {
    if (item.images.length >= IMAGES_MAX) return;
    const next = [
      ...item.images,
      {
        id: nanoid(),
        url: uploaded.url,
        width: uploaded.width,
        height: uploaded.height,
        alt: '',
      },
    ];
    onImagesChange(item.id, next, true);
  }

  function patchImage(imgId: string, patch: Partial<CaseStudyEditorImage>) {
    const next = item.images.map((i) => (i.id === imgId ? { ...i, ...patch } : i));
    onImagesChange(item.id, next, false);
  }

  function removeImage(imgId: string) {
    const next = item.images.filter((i) => i.id !== imgId);
    onImagesChange(item.id, next, true);
  }

  function handleImageDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = item.images.map((i) => i.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onImagesChange(item.id, arrayMove(item.images, from, to), true);
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${imageLabelOf(item.images, active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${imageLabelOf(item.images, active.id)} moved to position ${positionOf(imageIds, over.id)} of ${imageIds.length}.`
        : `${imageLabelOf(item.images, active.id)} is no longer over a drop position.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${imageLabelOf(item.images, active.id)} dropped at position ${positionOf(imageIds, over.id)} of ${imageIds.length}.`
        : `${imageLabelOf(item.images, active.id)} dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${imageLabelOf(item.images, active.id)} returned to its position.`,
  };

  return (
    <li ref={setNodeRef} style={style} className="list-none">
      <div
        className={
          'rounded-md border border-border bg-surface ' +
          (isDragging ? 'z-10 shadow-card motion-reduce:shadow-none' : '')
        }
      >
        <div className="flex items-center gap-2 px-2 py-2">
          <button
            type="button"
            ref={setActivatorNodeRef}
            aria-label={`Reorder ${cardLabel} (use arrow keys after pressing space)`}
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
            {cardLabel}
          </span>

          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            aria-label={`Remove ${cardLabel}`}
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
            aria-label="Remove this case study?"
            className="border-t border-border bg-destructive-bg px-4 py-3"
          >
            <p className="text-sm font-semibold text-foreground">
              Remove this case study?
            </p>
            <p className="mt-1 text-[13px] leading-tight text-muted-foreground">
              This deletes the case study and frees its images from your storage. This
              can’t be undone after you save.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmRemove(false);
                  onRemove(item.id);
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
              label="Title"
              value={str(item.title)}
              maxLength={TITLE_MAX}
              helper="Name this project — the one required field."
              placeholder="e.g. Rebrand for a neighborhood bakery"
              disabled={disabled}
              onChange={(e) => onPatch(item.id, { title: e.target.value })}
            />

            <div className="flex flex-col gap-4 sm:flex-row">
              <Input
                label="Role (optional)"
                value={str(item.role)}
                maxLength={META_MAX}
                placeholder="e.g. Lead designer"
                disabled={disabled}
                onChange={(e) => onPatch(item.id, { role: e.target.value })}
                className="flex-1"
              />
              <Input
                label="Client (optional)"
                value={str(item.client)}
                maxLength={META_MAX}
                placeholder="e.g. Sunrise Bakery"
                disabled={disabled}
                onChange={(e) => onPatch(item.id, { client: e.target.value })}
                className="flex-1"
              />
              <Input
                label="Year (optional)"
                value={str(item.year)}
                maxLength={YEAR_MAX}
                placeholder="e.g. 2025"
                disabled={disabled}
                onChange={(e) => onPatch(item.id, { year: e.target.value })}
                className="flex-1 sm:max-w-28"
              />
            </div>

            <Textarea
              label="Challenge (optional)"
              value={str(item.challenge)}
              maxLength={BLOCK_MAX}
              placeholder="What problem were you solving?"
              disabled={disabled}
              onChange={(e) => onPatch(item.id, { challenge: e.target.value })}
              trailing={<CharCounter value={str(item.challenge)} max={BLOCK_MAX} />}
            />
            <Textarea
              label="Process (optional)"
              value={str(item.process)}
              maxLength={BLOCK_MAX}
              placeholder="How did you approach it?"
              disabled={disabled}
              onChange={(e) => onPatch(item.id, { process: e.target.value })}
              trailing={<CharCounter value={str(item.process)} max={BLOCK_MAX} />}
            />
            <Textarea
              label="Outcome (optional)"
              value={str(item.outcome)}
              maxLength={BLOCK_MAX}
              placeholder="What was the result?"
              disabled={disabled}
              onChange={(e) => onPatch(item.id, { outcome: e.target.value })}
              trailing={<CharCounter value={str(item.outcome)} max={BLOCK_MAX} />}
            />

            {/* Nested image set (D-06) — own batch uploader (cap 5) + reorderable list. */}
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-semibold text-foreground">Images</h4>

              {atImageMax ? (
                <p className="text-[13px] leading-tight text-muted-foreground">
                  You’ve added the maximum of {IMAGES_MAX} images.
                </p>
              ) : (
                <GalleryUploader
                  onUploaded={onUploaded}
                  persistedUrls={persistedUrlsRef.current}
                />
              )}

              {isUnsupported ? (
                <p className="text-[13px] leading-tight text-muted-foreground">
                  {STORAGE_NUDGE}
                </p>
              ) : null}

              {item.images.length > 0 ? (
                <DndContext
                  id={`case-study-images-dnd-${item.id}`}
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  accessibility={{ announcements }}
                  onDragEnd={handleImageDragEnd}
                >
                  <SortableContext
                    items={imageIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="flex flex-col gap-2">
                      {item.images.map((image) => (
                        <InnerImageCard
                          key={image.id}
                          image={image}
                          disabled={disabled}
                          onPatch={patchImage}
                          onRemove={removeImage}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

function itemLabelOf(items: CaseStudyEditorItem[], id: string | number): string {
  const it = items.find((i) => i.id === id);
  return it ? str(it.title) || 'Untitled case study' : 'case study';
}

// ---------------------------------------------------------------------------
// CaseStudyManager — the outer item list + whole-section save
// ---------------------------------------------------------------------------

export interface CaseStudyManagerProps {
  sectionId: string;
  initialContent: Record<string, unknown>;
  username?: string;
  isUnsupported?: boolean;
}

export function CaseStudyManager({
  sectionId,
  initialContent,
  username,
  isUnsupported = false,
}: CaseStudyManagerProps) {
  const [heading, setHeading] = useState<string>(() => str(initialContent.heading));
  const [items, setItems] = useState<CaseStudyEditorItem[]>(() =>
    toEditorItems(initialContent),
  );
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const { state, scheduleSave, immediateSave } = useDebouncedSectionSave({
    sectionId,
    type: 'case_study',
    username,
    onSavedAndLive: () => setLive(true),
  });

  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => setLive(false), SAVED_BEAT_MS);
    return () => clearTimeout(t);
  }, [live]);

  const saving = state === 'saving';
  const error = reorderError ?? (state === 'error' ? SAVE_ERROR : null);

  const contentOf = useCallback(
    (h: string, its: CaseStudyEditorItem[]) =>
      buildCaseStudyContent(its, h) as unknown as Record<string, unknown>,
    [],
  );

  function onHeadingChange(value: string) {
    setHeading(value);
    setReorderError(null);
    scheduleSave(contentOf(value, items));
  }

  function addItem() {
    if (items.length >= ITEMS_MAX) return;
    const next: CaseStudyEditorItem[] = [
      ...items,
      {
        id: nanoid(),
        title: '',
        role: '',
        client: '',
        year: '',
        challenge: '',
        process: '',
        outcome: '',
        images: [],
      },
    ];
    setItems(next);
    setReorderError(null);
    // A freshly-added item has a blank required title — the structural pre-check SKIPS
    // the save (no doomed POST) until the title is filled.
    void immediateSave(contentOf(heading, next));
  }

  function patchItem(id: string, patch: Partial<CaseStudyEditorItem>) {
    const next = items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    setItems(next);
    setReorderError(null);
    scheduleSave(contentOf(heading, next));
  }

  function removeItem(id: string) {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    setReorderError(null);
    void immediateSave(contentOf(heading, next));
  }

  // A nested-image change (add/remove/reorder/alt-edit) bubbled up from an item card.
  function onItemImagesChange(
    id: string,
    nextImages: CaseStudyEditorImage[],
    immediate: boolean,
  ) {
    const next = items.map((i) => (i.id === id ? { ...i, images: nextImages } : i));
    setItems(next);
    setReorderError(null);
    if (immediate) void immediateSave(contentOf(heading, next));
    else scheduleSave(contentOf(heading, next));
  }

  function handleItemDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    const previous = items;
    const next = arrayMove(items, from, to);
    setItems(next); // optimistic
    setReorderError(null);
    void immediateSave(contentOf(heading, next)).then((result) => {
      if (result.ok) return;
      // A reorder preserves the same items; if any item is still awaiting its required
      // title or an image's alt the save is SKIPPED — keep the optimistic order.
      if (anyItemNotSaveable(next)) return;
      setItems(previous);
      setReorderError(REORDER_ERROR);
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const itemIds = items.map((i) => i.id);

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${itemLabelOf(items, active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${itemLabelOf(items, active.id)} moved to position ${positionOf(itemIds, over.id)} of ${itemIds.length}.`
        : `${itemLabelOf(items, active.id)} is no longer over a drop position.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${itemLabelOf(items, active.id)} dropped at position ${positionOf(itemIds, over.id)} of ${itemIds.length}.`
        : `${itemLabelOf(items, active.id)} dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${itemLabelOf(items, active.id)} returned to its position.`,
  };

  const atMax = items.length >= ITEMS_MAX;

  return (
    <div className="flex flex-col gap-6">
      <SaveStatus state={state} live={live} />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Input
        label="Heading (optional)"
        value={heading}
        maxLength={HEADING_MAX}
        helper="Name this section — e.g. Selected case studies."
        placeholder="e.g. Selected case studies"
        disabled={saving}
        onChange={(e) => onHeadingChange(e.target.value)}
      />

      {items.length === 0 ? (
        <p className="text-[13px] leading-tight text-muted-foreground">
          No case studies yet — add your first one.
        </p>
      ) : (
        <DndContext
          id={`case-study-items-dnd-${sectionId}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{ announcements }}
          onDragEnd={handleItemDragEnd}
        >
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-4">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  disabled={saving}
                  isUnsupported={isUnsupported}
                  onPatch={patchItem}
                  onRemove={removeItem}
                  onImagesChange={onItemImagesChange}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {atMax ? (
        <p className="text-[13px] leading-tight text-muted-foreground">
          You’ve added the maximum of {ITEMS_MAX} case studies.
        </p>
      ) : (
        <button
          type="button"
          onClick={addItem}
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
          Add case study
        </button>
      )}
    </div>
  );
}

/** True if an item is still structurally un-saveable (blank title or alt-less image). */
function anyItemNotSaveable(items: CaseStudyEditorItem[]): boolean {
  if (anyImageMissingAlt(items)) return true;
  return items.some((it) => str(it.title).trim() === '');
}
