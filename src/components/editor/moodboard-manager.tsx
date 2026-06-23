'use client';

/**
 * MoodboardManager (13.1-05 / D-12 — UI-SPEC §6) — the bespoke two-array section
 * editor: a captioned, required-alt, REORDERABLE image GALLERY + an optional,
 * constrained-hex color PALETTE. The two arrays live in one `sections.content`
 * (`moodboardContentSchema.items` ≤24 + `moodboardContentSchema.palette` ≤12), so
 * this is a hand-built manager with two clearly-labeled stacked sub-managers (it does
 * not fit the flat `ItemManager` shape — that is why it is bespoke, not a descriptor).
 *
 * GALLERY (the `image` sub-manager): a classic-dnd-kit reorderable list of image
 * cards. Each card reuses `ImageUploader kind="moodboard"` (the Plan-03 gallery upload
 * kind → the `media` bucket, bucket-quota-gated) with a co-located REQUIRED alt Input
 * + an optional caption (≤120). A gallery image whose required alt is still blank makes
 * the section SKIP-INVALID (no doomed save, no spurious error) until alt is provided —
 * a lightweight Zod-FREE structural pre-check (Pitfall 8, no barrel). The whole-section
 * save frees a removed/replaced gallery image's Storage object on the unchanged
 * `saveSectionAction` (the Plan-02 extended IMAGE_FIELDS includes `moodboard`).
 *
 * PALETTE (the optional `palette` sub-manager): a list of swatch rows — a hex Input
 * (`#RGB`/`#RRGGBB`) + a LIVE preview chip (`style={{ backgroundColor }}` — the ONE
 * sanctioned inline color, content gated by `paletteSwatchSchema`'s hex regex at the
 * server, NOT a design token) + an optional name (≤60). The palette is NOT
 * drag-reorderable (a short, order-insensitive list — gallery images ARE reorderable
 * per D-12; the palette is not).
 *
 * D-16 STORAGE NUDGE (co-located near the uploader): when the shell passes
 * `isUnsupported`, a muted, non-blocking caption renders the LOCKED copy near the
 * gallery uploader — an unrendered image still counts toward the 65 MiB quota.
 *
 * WHOLE-SECTION WRITE (Pitfall 7): every gallery/palette op rebuilds the WHOLE
 * `{ heading, subheading?, items: [...], palette?: [...] }` content and routes through
 * the UNCHANGED `saveSectionAction` via the Plan-03 shared debounce (field edits
 * `scheduleSave`; add / remove / reorder `immediateSave`).
 *
 * BUNDLE RULE (CLAUDE.md / D-25 — LOAD-BEARING): this `'use client'` island MUST NOT
 * import the `@/lib/validations` barrel or `templates/registry.ts` — the maxes (24
 * images / 12 swatches / 120 caption / 60 name) are inline UX LITERALS; the SERVER
 * re-parse inside `saveSectionAction` → `validateSectionContent` (incl. the `altTextOk`
 * refine + the palette hex regex) is the authoritative gate. The skip-invalid check is
 * a Zod-FREE structural probe.
 *
 * Two-layer identity (SHARED-E): chrome tokens ONLY (Evergreen/Copper). The ONLY
 * inline color in this file is the swatch preview chip (content, not a token).
 * Reduced-motion-safe.
 *
 * Source: the reorderable item-list + skip-invalid + ImageUploader wiring contract
 * from `item-card.tsx`; the `kind="moodboard"` slot + co-located required alt from
 * `image-uploader.tsx`; the shared save hook from `use-debounced-section-save.ts`.
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
import { GripVertical, Image as ImageIcon, Palette as PaletteIcon, Plus, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { CharCounter } from '@/components/ui/char-counter';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { ImageUploader } from './image-uploader';
import { SaveStatus } from './save-status';
import { useDebouncedSectionSave } from './use-debounced-section-save';

// ---------------------------------------------------------------------------
// UX-only LITERALS — mirror moodboardContentSchema's bounds (sections.ts). Client UX
// only; the SERVER re-parse is the gate (the Zod barrel is NOT imported — D-25).
// ---------------------------------------------------------------------------

/** `moodboardContentSchema.items.max(24)`. */
const IMAGES_MAX = 24;
/** `moodboardContentSchema.palette.max(12)`. */
const SWATCHES_MAX = 12;
/** `moodboardImageSchema.caption` max(120). */
const CAPTION_MAX = 120;
/** `paletteSwatchSchema.name` max(60). */
const SWATCH_NAME_MAX = 60;
/** `moodboardContentSchema.heading` max(100) / `subheading` max(300). */
const HEADING_MAX = 100;
const SUBHEADING_MAX = 300;

/** The `#RGB`/`#RRGGBB` shape — a UX mirror of `paletteSwatchSchema`'s server regex. */
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const SAVE_ERROR = 'We couldn’t save your changes. Please try again.';
const REORDER_ERROR =
  'We couldn’t save the new order — it’s been put back. Please try again.';
/** D-16 LOCKED nudge copy (UI-SPEC §6 / Copywriting) — muted, non-blocking. */
const STORAGE_NUDGE =
  'This image won’t show on your current template — it still counts toward your 65 MiB storage.';
const HEX_HINT = 'Enter a hex like #7C3AED';
/** ~2.2s saved-&-live beat hold (UI-SPEC Surface 4 / Motion "saved & live"). */
const SAVED_BEAT_MS = 2200;

// D-02 (UI-SPEC Surface 2 — D-02 applies to "every section form field" incl. the
// moodboard form): per-field helper + `e.g.` placeholder for the moodboard's primary
// first-run fields. The UI-SPEC Copywriting table is a "representative set" that
// directs the planner to extend to the live field set from the Zod schemas; these
// follow the house voice (calm, plain, profession-neutral, no exclamation, curly
// apostrophes). Helper = informational (aria-describedby/muted; the Input/Textarea
// `error` prop supersedes it); placeholder = the native `e.g.` example value.
const MOODBOARD_FIELD_GUIDANCE = {
  heading: {
    helper: 'Name this gallery — what ties these images together.',
    placeholder: 'e.g. Selected work',
  },
  caption: {
    helper: 'A short label for this image.',
    placeholder: 'e.g. Brand refresh — hero shot',
  },
} as const;

const str = (v: unknown) => (typeof v === 'string' ? v : '');

// ---------------------------------------------------------------------------
// Editor-state model
// ---------------------------------------------------------------------------

/** One gallery image in the editor's working state. `id` is PERSISTED (schema requires it). */
export interface MoodboardEditorImage {
  /** Persisted nanoid (`moodboardImageSchema.id`) — KEPT in the write. */
  id: string;
  image?: string;
  image_alt?: string;
  caption?: string;
}

/** One palette swatch in the editor's working state. `__id` is CLIENT-ONLY (key). */
export interface MoodboardEditorSwatch {
  /** Client-only stable key (nanoid) — STRIPPED by `buildMoodboardContent`. */
  __id: string;
  color: string;
  name?: string;
}

/** The persisted (schema-shaped) gallery image — KEEPS `id` (matches `moodboardImageSchema`). */
interface PersistedImage {
  id: string;
  image?: string;
  image_alt?: string;
  caption?: string;
}

/** The persisted (schema-shaped) swatch — NO `__id` (matches `paletteSwatchSchema`). */
interface PersistedSwatch {
  color: string;
  name?: string;
}

/** The persisted moodboard content (matches `moodboardContentSchema`). */
export interface MoodboardContentShape {
  heading: string;
  subheading?: string;
  items: PersistedImage[];
  palette?: PersistedSwatch[];
}

export interface BuildMoodboardInput {
  heading: string;
  subheading: string;
  images: MoodboardEditorImage[];
  swatches: MoodboardEditorSwatch[];
}

// ---------------------------------------------------------------------------
// PURE builder (exported, render-free, node-unit-testable — the skills-form precedent)
// ---------------------------------------------------------------------------

/**
 * PURE: rebuild the WHOLE `{ heading, subheading?, items: [...], palette?: [...] }`
 * moodboard content from the editor's working state (Pitfall 7). The gallery image
 * `id` is KEPT (the schema requires it); the swatch client-only `__id` is STRIPPED.
 * `subheading` is OMITTED when blank and `palette` is OMITTED when empty (both
 * `.optional()`); absent per-field optionals (image/alt/caption/name) are omitted.
 *
 * The builder does NOT clamp/validate — the SERVER re-parse (`moodboardContentSchema`,
 * incl. the `altTextOk` refine + the palette hex regex) stays the sole authority.
 *
 * Exported (no DOM needed) so the save payload is unit-testable in the `node` vitest
 * project (the storage-meter / skills-form precedent).
 */
export function buildMoodboardContent(input: BuildMoodboardInput): MoodboardContentShape {
  const content: MoodboardContentShape = {
    heading: input.heading,
    items: input.images.map((img) => {
      const out: PersistedImage = { id: img.id };
      if (img.image !== undefined && img.image !== '') out.image = img.image;
      if (img.image_alt !== undefined && img.image_alt !== '') out.image_alt = img.image_alt;
      if (img.caption !== undefined && img.caption !== '') out.caption = img.caption;
      return out;
    }),
  };

  if (input.subheading.trim() !== '') {
    content.subheading = input.subheading;
  }

  if (input.swatches.length > 0) {
    content.palette = input.swatches.map((sw) => {
      const out: PersistedSwatch = { color: sw.color };
      if (sw.name !== undefined && sw.name !== '') out.name = sw.name;
      return out;
    });
  }

  return content;
}

/** Read the initial editor images from the section's persisted content (KEEP/mint ids). */
function toEditorImages(initialContent: Record<string, unknown>): MoodboardEditorImage[] {
  const raw = Array.isArray(initialContent.items) ? initialContent.items : [];
  return raw.map((i) => {
    const it = (i ?? {}) as Record<string, unknown>;
    const img: MoodboardEditorImage = {
      id: typeof it.id === 'string' && it.id !== '' ? it.id : nanoid(),
    };
    if (typeof it.image === 'string') img.image = it.image;
    if (typeof it.image_alt === 'string') img.image_alt = it.image_alt;
    if (typeof it.caption === 'string') img.caption = it.caption;
    return img;
  });
}

/** Read the initial editor swatches from the section's persisted content (mint `__id`s). */
function toEditorSwatches(initialContent: Record<string, unknown>): MoodboardEditorSwatch[] {
  const raw = Array.isArray(initialContent.palette) ? initialContent.palette : [];
  return raw.map((s) => {
    const sw = (s ?? {}) as Record<string, unknown>;
    const out: MoodboardEditorSwatch = {
      __id: nanoid(),
      color: typeof sw.color === 'string' ? sw.color : '',
    };
    if (typeof sw.name === 'string') out.name = sw.name;
    return out;
  });
}

// ---------------------------------------------------------------------------
// ImageCard — one sortable gallery image (uploader + required alt + caption)
// ---------------------------------------------------------------------------

interface ImageCardProps {
  image: MoodboardEditorImage;
  isUnsupported: boolean;
  disabled: boolean;
  onPatch: (id: string, patch: Partial<MoodboardEditorImage>) => void;
  onRemove: (id: string) => void;
  /**
   * D-11: the LAST-SAVED baseline URL for this gallery image (the TanStack-cache
   * persisted value at mount), passed into the ImageUploader so a replace/remove
   * before save frees only unsaved churn ('' when this slot was never saved).
   */
  persistedImageValue?: string;
}

function ImageCard({
  image,
  isUnsupported,
  disabled,
  onPatch,
  onRemove,
  persistedImageValue,
}: ImageCardProps) {
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

  const cardLabel = str(image.caption) || str(image.image_alt) || 'image';

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
          <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
            {/* The gallery image slot — the Plan-03 `moodboard` upload kind. URL + the
                co-located REQUIRED alt both patch into the whole-section write (Pitfall
                7). The server `altTextOk` refine is the real gate. */}
            <ImageUploader
              kind="moodboard"
              label="Image"
              value={str(image.image)}
              onValueChange={(url) => onPatch(image.id, { image: url })}
              alt={str(image.image_alt)}
              onAltChange={(a) => onPatch(image.id, { image_alt: a })}
              // D-11: the saved baseline for this gallery image (free-on-replace
              // targets only unsaved churn; '' when this slot was never saved).
              persistedValue={persistedImageValue}
            />

            {/* D-16 storage nudge — co-located near the uploader, muted + non-blocking. */}
            {isUnsupported ? (
              <p className="text-[13px] leading-tight text-muted-foreground">
                {STORAGE_NUDGE}
              </p>
            ) : null}

            <Input
              label="Caption (optional)"
              value={str(image.caption)}
              maxLength={CAPTION_MAX}
              // D-02: helper + `e.g.` placeholder (error supersedes helper).
              helper={MOODBOARD_FIELD_GUIDANCE.caption.helper}
              placeholder={MOODBOARD_FIELD_GUIDANCE.caption.placeholder}
              disabled={disabled}
              onChange={(e) => onPatch(image.id, { caption: e.target.value })}
            />
          </div>
        )}
      </div>
    </li>
  );
}

/** Resolve a gallery image card label from its sortable id (announcement helper). */
function imageLabelOf(images: MoodboardEditorImage[], id: string | number): string {
  const it = images.find((i) => i.id === id);
  return it ? str(it.caption) || str(it.image_alt) || 'image' : 'image';
}

/** 1-based position of an image id in the ordered list (announcement helper). */
function imagePositionOf(ids: string[], id: string | number): number {
  return ids.indexOf(String(id)) + 1;
}

// ---------------------------------------------------------------------------
// SwatchRow — one palette swatch (hex + live preview chip + name) — NO drag (D-12)
// ---------------------------------------------------------------------------

interface SwatchRowProps {
  swatch: MoodboardEditorSwatch;
  disabled: boolean;
  onPatch: (sid: string, patch: Partial<MoodboardEditorSwatch>) => void;
  onRemove: (sid: string) => void;
}

function SwatchRow({ swatch, disabled, onPatch, onRemove }: SwatchRowProps) {
  const [hexTouched, setHexTouched] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const hex = str(swatch.color);
  const validHex = HEX_RE.test(hex);
  const hexError = hexTouched && hex.trim() !== '' && !validHex ? HEX_HINT : undefined;
  const swatchLabel = str(swatch.name) || hex || 'color';

  if (confirmRemove) {
    return (
      <li className="list-none">
        <div
          role="alertdialog"
          aria-label="Remove this color?"
          className="rounded-md border border-border bg-destructive-bg px-4 py-3"
        >
          <p className="text-sm font-semibold text-foreground">Remove this color?</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmRemove(false);
                onRemove(swatch.__id);
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
      </li>
    );
  }

  return (
    <li className="list-none">
      <div className="rounded-md border border-border bg-surface px-3 py-3">
        <div className="flex items-end gap-3">
          {/* Live preview chip — the ONE sanctioned inline color (content gated by the
              server hex regex, NOT a design token). Only render a valid hex; an invalid
              draft shows the neutral track. */}
          <span
            aria-hidden="true"
            className="size-9 shrink-0 rounded-sm border border-border bg-surface-muted"
            style={validHex ? { backgroundColor: hex } : undefined}
          />
          <Input
            label="Hex"
            value={hex}
            placeholder="#7C3AED"
            error={hexError}
            disabled={disabled}
            onChange={(e) => onPatch(swatch.__id, { color: e.target.value })}
            onBlur={() => setHexTouched(true)}
            className="w-32 shrink-0"
          />
          <Input
            label="Name (optional)"
            value={str(swatch.name)}
            maxLength={SWATCH_NAME_MAX}
            disabled={disabled}
            onChange={(e) => onPatch(swatch.__id, { name: e.target.value })}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            aria-label={`Remove swatch ${swatchLabel}`}
            className={
              'flex size-11 shrink-0 items-center justify-center rounded-sm ' +
              'text-muted-foreground outline-none hover:text-destructive ' +
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring'
            }
          >
            <Trash2 aria-hidden="true" className="size-5" />
          </button>
        </div>
        {/* D-16: the dead hidden duplicate-hint branch is REMOVED — the hex hint
            already renders inline via the Input's `error` prop above (the standalone
            duplicate path was unused). Its now-unused import is dropped with it. */}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// MoodboardManager — the gallery DndContext + the palette list + the whole-section save
// ---------------------------------------------------------------------------

export interface MoodboardManagerProps {
  sectionId: string;
  /** The section's current content (from TanStack Query — the source of truth). */
  initialContent: Record<string, unknown>;
  /** The owner's username, passed so the revalidate needs no extra round-trip. */
  username?: string;
  /**
   * Whether the active template can't render `moodboard` (the shell passes this). When
   * true, the D-16 storage nudge renders near each gallery uploader (non-blocking).
   */
  isUnsupported?: boolean;
}

export function MoodboardManager({
  sectionId,
  initialContent,
  username,
  isUnsupported = false,
}: MoodboardManagerProps) {
  const [heading, setHeading] = useState<string>(() => str(initialContent.heading));
  const [subheading, setSubheading] = useState<string>(() => str(initialContent.subheading));
  const [images, setImages] = useState<MoodboardEditorImage[]>(() =>
    toEditorImages(initialContent),
  );
  const [swatches, setSwatches] = useState<MoodboardEditorSwatch[]>(() =>
    toEditorSwatches(initialContent),
  );
  const [reorderError, setReorderError] = useState<string | null>(null);

  // D-11: the per-image LAST-SAVED baseline, captured ONCE from the mounted
  // (TanStack-cache) content. Each gallery ImageUploader gets its image's saved URL as
  // `persistedValue`, so a replace/remove before save frees only unsaved churn (the
  // persisted object's churn is the server on-save diff's job — WR-03). Never mutated
  // (the baseline is "what was saved", not the live value).
  const persistedImageBaseline = useRef<Map<string, string>>(
    new Map(
      toEditorImages(initialContent)
        .map((img) => [img.id, typeof img.image === 'string' ? img.image : ''] as const)
        .filter(([, url]) => url !== ''),
    ),
  );

  // D-04/D-05: the saved-&-live BEAT window (opened by `onSavedAndLive`, settled after
  // ~2.2s) — brings the dopamine beat to this auto-save model (parity with the explicit
  // model). The hook fires ONLY on the latest resolved-ok save (never-claim-live-early).
  const [live, setLive] = useState(false);

  const { state, scheduleSave, immediateSave } = useDebouncedSectionSave({
    sectionId,
    type: 'moodboard',
    username,
    onSavedAndLive: () => setLive(true), // D-04
  });

  // D-04: settle the beat window back after ~2.2s (the explicit model's SAVED_BEAT_MS).
  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => setLive(false), SAVED_BEAT_MS);
    return () => clearTimeout(t);
  }, [live]);

  const saving = state === 'saving';
  const error = reorderError ?? (state === 'error' ? SAVE_ERROR : null);

  /** Build the WHOLE next content from the editor working state (Pitfall 7). */
  const contentOf = useCallback(
    (
      h: string,
      sub: string,
      imgs: MoodboardEditorImage[],
      sws: MoodboardEditorSwatch[],
    ) =>
      buildMoodboardContent({
        heading: h,
        subheading: sub,
        images: imgs,
        swatches: sws,
      }) as unknown as Record<string, unknown>,
    [],
  );

  // ── Section header fields (field edits → debounced save) ──
  function onHeadingChange(value: string) {
    setHeading(value);
    setReorderError(null);
    scheduleSave(contentOf(value, subheading, images, swatches));
  }

  function onSubheadingChange(value: string) {
    setSubheading(value);
    setReorderError(null);
    scheduleSave(contentOf(heading, value, images, swatches));
  }

  // ── Gallery: add / patch / remove ──
  function addImage() {
    if (images.length >= IMAGES_MAX) return;
    const next = [...images, { id: nanoid() }];
    setImages(next);
    setReorderError(null);
    // A freshly-added blank image has no URL yet → the structural pre-check treats it
    // as saveable (no image, no required alt); the save is a real write that appends it.
    void immediateSave(contentOf(heading, subheading, next, swatches));
  }

  function patchImage(id: string, patch: Partial<MoodboardEditorImage>) {
    const next = images.map((i) => (i.id === id ? { ...i, ...patch } : i));
    setImages(next);
    setReorderError(null);
    // Skip-invalid (Pitfall 8): while any image has a URL but a blank required alt, the
    // hook's `isSaveableSnapshot` skips the debounced save (no doomed POST, no error)
    // until the alt is provided.
    scheduleSave(contentOf(heading, subheading, next, swatches));
  }

  function removeImage(id: string) {
    const next = images.filter((i) => i.id !== id);
    setImages(next);
    setReorderError(null);
    // The removed image's Storage object is freed server-side on save (the Plan-02
    // extended IMAGE_FIELDS includes `moodboard`).
    void immediateSave(contentOf(heading, subheading, next, swatches));
  }

  // ── Gallery reorder (optimistic) ──
  function handleGalleryDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = images.map((i) => i.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    const previous = images;
    const next = arrayMove(images, from, to);
    setImages(next); // optimistic
    setReorderError(null);
    const content = contentOf(heading, subheading, next, swatches);
    void immediateSave(content).then((result) => {
      if (result.ok) return;
      // The hook returns { ok:false } for BOTH a skip-invalid and a real failure. A
      // reorder preserves the same images (incl. alts), so if any image is still
      // awaiting its alt the whole-section save is SKIPPED — keep the optimistic order
      // (it persists on the next valid save) and do NOT raise REORDER_ERROR.
      if (anyImageMissingAlt(next)) return;
      setImages(previous);
      setReorderError(REORDER_ERROR);
    });
  }

  // ── Palette: add / patch / remove (NO drag-reorder — D-12) ──
  function addSwatch() {
    if (swatches.length >= SWATCHES_MAX) return;
    const next = [...swatches, { __id: nanoid(), color: '' }];
    setSwatches(next);
    setReorderError(null);
    void immediateSave(contentOf(heading, subheading, images, next));
  }

  function patchSwatch(sid: string, patch: Partial<MoodboardEditorSwatch>) {
    const next = swatches.map((s) => (s.__id === sid ? { ...s, ...patch } : s));
    setSwatches(next);
    setReorderError(null);
    scheduleSave(contentOf(heading, subheading, images, next));
  }

  function removeSwatch(sid: string) {
    const next = swatches.filter((s) => s.__id !== sid);
    setSwatches(next);
    setReorderError(null);
    void immediateSave(contentOf(heading, subheading, images, next));
  }

  const gallerySensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const imageIds = images.map((i) => i.id);

  const galleryAnnouncements: Announcements = {
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

  const atImageMax = images.length >= IMAGES_MAX;
  const atSwatchMax = swatches.length >= SWATCHES_MAX;

  return (
    <div className="flex flex-col gap-6">
      {/* D-04/D-05: the unified save-status line (status + saved-&-live beat), at the
          top of the manager under the section <h2> the editor-shell wrapper renders —
          so this auto-save model reads identically to the explicit Save model. */}
      <SaveStatus state={state} live={live} />

      {error ? <Alert variant="error">{error}</Alert> : null}

      {/* Section header fields. */}
      <Input
        label="Heading"
        value={heading}
        maxLength={HEADING_MAX}
        // D-02: helper + `e.g.` placeholder (error supersedes helper).
        helper={MOODBOARD_FIELD_GUIDANCE.heading.helper}
        placeholder={MOODBOARD_FIELD_GUIDANCE.heading.placeholder}
        disabled={saving}
        onChange={(e) => onHeadingChange(e.target.value)}
      />
      <Textarea
        label="Subheading (optional)"
        value={subheading}
        maxLength={SUBHEADING_MAX}
        disabled={saving}
        onChange={(e) => onSubheadingChange(e.target.value)}
        trailing={<CharCounter value={subheading} max={SUBHEADING_MAX} />}
      />

      {/* ── Gallery sub-manager (reorderable). ── */}
      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ImageIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          Gallery
        </h3>

        {images.length === 0 ? (
          <p className="text-[13px] leading-tight text-muted-foreground">
            No images yet — add your first one.
          </p>
        ) : (
          <DndContext
            id={`moodboard-gallery-dnd-${sectionId}`}
            sensors={gallerySensors}
            collisionDetection={closestCenter}
            accessibility={{ announcements: galleryAnnouncements }}
            onDragEnd={handleGalleryDragEnd}
          >
            <SortableContext items={imageIds} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-4">
                {images.map((image) => (
                  <ImageCard
                    key={image.id}
                    image={image}
                    isUnsupported={isUnsupported}
                    disabled={saving}
                    onPatch={patchImage}
                    onRemove={removeImage}
                    // D-11: this image's saved baseline (free-on-replace = unsaved churn only).
                    persistedImageValue={persistedImageBaseline.current.get(image.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {atImageMax ? (
          <p className="text-[13px] leading-tight text-muted-foreground">
            You’ve added the maximum of {IMAGES_MAX} images.
          </p>
        ) : (
          <button
            type="button"
            onClick={addImage}
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
            Add image
          </button>
        )}
      </section>

      {/* ── Palette sub-manager (optional, NOT reorderable). ── */}
      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <PaletteIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          Color palette (optional)
        </h3>

        {swatches.length === 0 ? (
          <p className="text-[13px] leading-tight text-muted-foreground">
            No colors yet (optional).
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {swatches.map((swatch) => (
              <SwatchRow
                key={swatch.__id}
                swatch={swatch}
                disabled={saving}
                onPatch={patchSwatch}
                onRemove={removeSwatch}
              />
            ))}
          </ul>
        )}

        {atSwatchMax ? (
          <p className="text-[13px] leading-tight text-muted-foreground">
            You’ve added the maximum of {SWATCHES_MAX} colors.
          </p>
        ) : (
          <button
            type="button"
            onClick={addSwatch}
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
            Add color
          </button>
        )}
      </section>
    </div>
  );
}

/** True if any gallery image has a URL but a blank required alt (skip-invalid probe —
 *  the reorder skip-vs-fail distinction; mirrors the hook's Zod-FREE structural rule). */
function anyImageMissingAlt(images: MoodboardEditorImage[]): boolean {
  return images.some((i) => str(i.image).trim() !== '' && str(i.image_alt).trim() === '');
}
