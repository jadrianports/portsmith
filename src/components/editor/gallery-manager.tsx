'use client';

/**
 * GalleryManager (35-02 / GAL-01 — v2.8 "Show the Work") — the clean-photo-wall
 * editor: a single batch GalleryUploader (Phase-34 primitive) feeding a REORDERABLE
 * list of native-aspect image cards, each with a REQUIRED alt input + remove. NO
 * captions, NO titles, NO links (D-02 — keeps `gallery` distinct from BOTH `moodboard`
 * (captions/palette) and `projects` (titles/links): the image IS the work).
 *
 * A slim sibling of MoodboardManager (the analog): same @dnd-kit CLASSIC reorder
 * (`@dnd-kit/core` 6.3.1 — NEVER `@dnd-kit/react`), same `useDebouncedSectionSave`
 * shared hook, same PURE exported content builder (`buildGalleryContent` — render-free,
 * node-unit-testable). The ONE structural divergence: images arrive via a single batch
 * `GalleryUploader` (emitting `{url,width,height}`) rather than a per-card single
 * uploader, and each item carries the stored intrinsic `width`/`height` (CLS-safe in
 * Phase-36 rendering).
 *
 * ORPHAN BELT (T-35-ORPHAN / D-09): the manager supplies `persistedUrls` = a
 * ReadonlySet of the section's currently-SAVED urls (mirrored via a ref) so the
 * GalleryUploader frees only unsaved upload churn on unmount; persisted deletes are
 * handled by the Plan-01 server delete-diff (gallery flat `['url']`).
 *
 * WHOLE-SECTION WRITE (Pitfall 7): every add/remove/reorder/alt-edit rebuilds the WHOLE
 * `{ heading?, items: [...] }` content and routes through the UNCHANGED saveSectionAction
 * via the shared debounce (field edits `scheduleSave`; add/remove/reorder `immediateSave`).
 *
 * BUNDLE RULE (CLAUDE.md / D-25): this `'use client'` island MUST NOT import the
 * `@/lib/validations` barrel — the 40 cap + 100 heading are inline UX LITERALS; the
 * SERVER re-parse (`galleryContentSchema`, incl. the alt + `z.url({protocol})` gate) is
 * the authoritative boundary. The builder does NOT clamp/validate (server is the gate).
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
import { GripVertical, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';

import { GalleryUploader, type GalleryUploadItem } from './gallery-uploader';
import { SaveStatus } from './save-status';
import { useDebouncedSectionSave } from './use-debounced-section-save';

// ---------------------------------------------------------------------------
// UX-only LITERALS — mirror galleryContentSchema's bounds (sections.ts). Client UX
// only; the SERVER re-parse is the gate (the Zod barrel is NOT imported — D-25).
// ---------------------------------------------------------------------------

/** `galleryContentSchema.items.max(40)` (GAL-01 / T-35-DOS). */
const IMAGES_MAX = 40;
/** `galleryContentSchema.heading` max(100). */
const HEADING_MAX = 100;
/** ~2.2s saved-&-live beat hold (parity with MoodboardManager). */
const SAVED_BEAT_MS = 2200;

const SAVE_ERROR = 'We couldn’t save your changes. Please try again.';
const REORDER_ERROR =
  'We couldn’t save the new order — it’s been put back. Please try again.';
/** D-16 LOCKED nudge copy — muted, non-blocking (unsupported on the active template). */
const STORAGE_NUDGE =
  'These images won’t show on your current template — they still count toward your 65 MiB storage.';

const str = (v: unknown) => (typeof v === 'string' ? v : '');

// ---------------------------------------------------------------------------
// Editor-state model
// ---------------------------------------------------------------------------

/** One gallery image in the editor's working state. Every field is PERSISTED. */
export interface GalleryEditorImage {
  /** Persisted nanoid (`galleryImageSchema.id`) — KEPT in the write. */
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** The persisted (schema-shaped) gallery image — matches `galleryImageSchema`. */
interface PersistedGalleryImage {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** The persisted gallery content (matches `galleryContentSchema`). */
export interface GalleryContentShape {
  heading?: string;
  items: PersistedGalleryImage[];
}

// ---------------------------------------------------------------------------
// PURE builder (exported, render-free, node-unit-testable — the moodboard precedent)
// ---------------------------------------------------------------------------

/**
 * PURE: rebuild the WHOLE `{ heading?, items: [...] }` gallery content from the
 * editor's working state (Pitfall 7). The image `id`/`url`/`width`/`height`/`alt` are
 * all KEPT (the schema requires them); `heading` is OMITTED when blank (`.optional()`).
 *
 * The builder does NOT clamp/validate — the SERVER re-parse (`galleryContentSchema`,
 * incl. the alt rule + `z.url({ protocol })` stored-XSS gate) stays the sole authority.
 *
 * Exported (no DOM needed) so the save payload is unit-testable in the `node` vitest
 * project (the `buildMoodboardContent` precedent).
 */
export function buildGalleryContent(
  images: GalleryEditorImage[],
  heading?: string,
): GalleryContentShape {
  const content: GalleryContentShape = {
    items: images.map((img) => ({
      id: img.id,
      url: img.url,
      width: img.width,
      height: img.height,
      alt: img.alt,
    })),
  };
  if (heading !== undefined && heading.trim() !== '') content.heading = heading;
  return content;
}

/** A positive-integer dimension, mirroring `galleryImageSchema` (`z.number().int().positive()`). */
function posIntDim(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

/**
 * Read the initial editor images from the section's persisted content (KEEP/mint ids).
 * WR-02 (35-REVIEW): PRUNE any persisted image whose `url`/dims are not server-valid
 * (blank url, or non-positive-int width/height) rather than fabricating a `0` the schema
 * is guaranteed to reject — a corrupt/legacy row would otherwise silently wedge the whole
 * section against the next save (every rebuild re-emits the bad image). Corrupt rows are
 * dropped, mirroring how a blank `id` is re-minted; the SERVER re-parse stays the gate.
 */
function toEditorImages(initialContent: Record<string, unknown>): GalleryEditorImage[] {
  const raw = Array.isArray(initialContent.items) ? initialContent.items : [];
  const out: GalleryEditorImage[] = [];
  for (const i of raw) {
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

// ---------------------------------------------------------------------------
// ImageCard — one sortable gallery image (thumbnail + required alt + remove)
// ---------------------------------------------------------------------------

interface ImageCardProps {
  image: GalleryEditorImage;
  disabled: boolean;
  onPatch: (id: string, patch: Partial<GalleryEditorImage>) => void;
  onRemove: (id: string) => void;
}

function ImageCard({ image, disabled, onPatch, onRemove }: ImageCardProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);

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

          {/* eslint-disable-next-line @next/next/no-img-element — editor-only preview
              of a same-origin Storage object; intrinsic dims keep it CLS-safe. */}
          <img
            src={image.url}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-sm border border-border object-cover"
          />

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
            aria-label="Remove this image?"
            className="border-t border-border bg-destructive-bg px-4 py-3"
          >
            <p className="text-sm font-semibold text-foreground">Remove this image?</p>
            <p className="mt-1 text-[13px] leading-tight text-muted-foreground">
              This deletes the image from your gallery and frees it from your storage.
              This can’t be undone after you save.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmRemove(false);
                  onRemove(image.id);
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
          <div className="border-t border-border px-4 py-4">
            {/* The REQUIRED alt (D-02 — the only per-image field). Field edit →
                scheduleSave; the server alt rule is the real gate. */}
            <Input
              label="Alt text"
              value={str(image.alt)}
              helper="Describe this image for screen readers and search."
              placeholder="e.g. Hand-lettered poster on a brick wall"
              disabled={disabled}
              onChange={(e) => onPatch(image.id, { alt: e.target.value })}
            />
          </div>
        )}
      </div>
    </li>
  );
}

/** Resolve an image card label from its sortable id (announcement helper). */
function imageLabelOf(images: GalleryEditorImage[], id: string | number): string {
  const it = images.find((i) => i.id === id);
  return it ? str(it.alt) || 'image' : 'image';
}

/** 1-based position of an image id in the ordered list (announcement helper). */
function imagePositionOf(ids: string[], id: string | number): number {
  return ids.indexOf(String(id)) + 1;
}

// ---------------------------------------------------------------------------
// GalleryManager — the batch uploader + reorderable card list + whole-section save
// ---------------------------------------------------------------------------

export interface GalleryManagerProps {
  sectionId: string;
  /** The section's current content (from TanStack Query — the source of truth). */
  initialContent: Record<string, unknown>;
  /** The owner's username, passed so the revalidate needs no extra round-trip. */
  username?: string;
  /** Whether the active template can't render `gallery` (drives the D-16 nudge). */
  isUnsupported?: boolean;
}

export function GalleryManager({
  sectionId,
  initialContent,
  username,
  isUnsupported = false,
}: GalleryManagerProps) {
  const [heading, setHeading] = useState<string>(() => str(initialContent.heading));
  const [images, setImages] = useState<GalleryEditorImage[]>(() =>
    toEditorImages(initialContent),
  );
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const { state, scheduleSave, immediateSave } = useDebouncedSectionSave({
    sectionId,
    type: 'gallery',
    username,
    onSavedAndLive: () => setLive(true),
  });

  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => setLive(false), SAVED_BEAT_MS);
    return () => clearTimeout(t);
  }, [live]);

  // T-35-ORPHAN / D-09: the SET of urls the form has currently SAVED, mirrored to a ref
  // so the GalleryUploader's unmount belt reconciles against the latest persisted set
  // (frees only unsaved upload churn). Kept in lock-step with `images`.
  const persistedUrlsRef = useRef<Set<string>>(
    new Set(toEditorImages(initialContent).map((i) => i.url).filter((u) => u !== '')),
  );
  useEffect(() => {
    persistedUrlsRef.current = new Set(images.map((i) => i.url).filter((u) => u !== ''));
  }, [images]);

  const saving = state === 'saving';
  const error = reorderError ?? (state === 'error' ? SAVE_ERROR : null);

  const contentOf = useCallback(
    (h: string, imgs: GalleryEditorImage[]) =>
      buildGalleryContent(imgs, h) as unknown as Record<string, unknown>,
    [],
  );

  function onHeadingChange(value: string) {
    setHeading(value);
    setReorderError(null);
    scheduleSave(contentOf(value, images));
  }

  // The batch uploader emits one item per successful upload — append + immediateSave.
  function onUploaded(item: GalleryUploadItem) {
    setImages((prev) => {
      if (prev.length >= IMAGES_MAX) return prev;
      const next = [
        ...prev,
        { id: nanoid(), url: item.url, width: item.width, height: item.height, alt: '' },
      ];
      // A freshly-uploaded image has an empty required alt — the structural pre-check
      // SKIPS the save until alt is provided (no doomed POST). The append still lives
      // in local state + the orphan belt's persisted set updates via the effect.
      void immediateSave(contentOf(heading, next));
      return next;
    });
    setReorderError(null);
  }

  function patchImage(id: string, patch: Partial<GalleryEditorImage>) {
    const next = images.map((i) => (i.id === id ? { ...i, ...patch } : i));
    setImages(next);
    setReorderError(null);
    // Skip-invalid: while any image's required alt is blank the hook skips the save.
    scheduleSave(contentOf(heading, next));
  }

  function removeImage(id: string) {
    const next = images.filter((i) => i.id !== id);
    setImages(next);
    setReorderError(null);
    // The removed image's Storage object is freed server-side on save (Plan-01 diff).
    void immediateSave(contentOf(heading, next));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = images.map((i) => i.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    const previous = images;
    const next = arrayMove(images, from, to);
    setImages(next); // optimistic
    setReorderError(null);
    void immediateSave(contentOf(heading, next)).then((result) => {
      if (result.ok) return;
      // A reorder preserves the same images (incl. alts); if any image is still
      // awaiting its required alt the whole-section save is SKIPPED — keep the
      // optimistic order (it persists on the next valid save) and do NOT raise the error.
      if (anyImageMissingAlt(next)) return;
      setImages(previous);
      setReorderError(REORDER_ERROR);
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const imageIds = images.map((i) => i.id);

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${imageLabelOf(images, active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${imageLabelOf(images, active.id)} moved to position ${imagePositionOf(imageIds, over.id)} of ${imageIds.length}.`
        : `${imageLabelOf(images, active.id)} is no longer over a drop position.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${imageLabelOf(images, active.id)} dropped at position ${imagePositionOf(imageIds, over.id)} of ${imageIds.length}.`
        : `${imageLabelOf(images, active.id)} dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${imageLabelOf(images, active.id)} returned to its position.`,
  };

  const atMax = images.length >= IMAGES_MAX;

  return (
    <div className="flex flex-col gap-6">
      <SaveStatus state={state} live={live} />

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Input
        label="Heading (optional)"
        value={heading}
        maxLength={HEADING_MAX}
        helper="Name this gallery — what ties these images together."
        placeholder="e.g. Selected work"
        disabled={saving}
        onChange={(e) => onHeadingChange(e.target.value)}
      />

      {/* The batch uploader — emits {url,width,height} per item; the orphan belt frees
          unsaved churn via `persistedUrls`. Hidden at the cap (the Zod cap is the
          hard backstop). */}
      {atMax ? (
        <p className="text-[13px] leading-tight text-muted-foreground">
          You’ve added the maximum of {IMAGES_MAX} images.
        </p>
      ) : (
        <GalleryUploader onUploaded={onUploaded} persistedUrls={persistedUrlsRef.current} />
      )}

      {isUnsupported ? (
        <p className="text-[13px] leading-tight text-muted-foreground">{STORAGE_NUDGE}</p>
      ) : null}

      {images.length === 0 ? (
        <p className="text-[13px] leading-tight text-muted-foreground">
          No images yet — add your first ones above.
        </p>
      ) : (
        <DndContext
          id={`gallery-dnd-${sectionId}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{ announcements }}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={imageIds} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-4">
              {images.map((image) => (
                <ImageCard
                  key={image.id}
                  image={image}
                  disabled={saving}
                  onPatch={patchImage}
                  onRemove={removeImage}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

/** True if any image has a URL but a blank required alt (skip-vs-fail probe). */
function anyImageMissingAlt(images: GalleryEditorImage[]): boolean {
  return images.some((i) => str(i.url).trim() !== '' && str(i.alt).trim() === '');
}
