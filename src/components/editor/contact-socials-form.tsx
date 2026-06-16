'use client';

/**
 * ContactSocialsForm island (24-UI-SPEC "Contact & Socials", SET-01/02/03,
 * D-07/D-14/D-15) — the editor surface that wires the four editable contact/social
 * fields (`email_public`, `socials`, `location`, `phone`) to `saveSettingsAction`.
 * This is the user-facing delivery of the write path Plans 01-02 sealed but that had
 * no reachable surface; `EditorShell` renders this when the new "Contact & Socials"
 * rail entry is selected (the 4th sentinel `activeSectionId`, D-07).
 *
 * Mirrors `profile-form.tsx` EXACTLY for the save lifecycle (SHARED-A consumer): the
 * save is NOT optimistic (D-14) — the SaveButton holds "Saving…" until the action
 * resolves; on `{ ok:true }` the dirty flag clears and the saved-&-live beat fires.
 * The `UrlInput` client http(s) check is UX only; `saveSettingsAction`'s Zod re-parse
 * is the real gate (a `javascript:`/`data:` URL is rejected server-side, T-24-09).
 *
 * Socials list (SET-02): an in-form `{ key, platform, url }[]` where `key` is a
 * CLIENT-ONLY synthetic id (crypto.randomUUID) minted on load/add — NEVER persisted
 * (D-15). Add / edit / reorder / remove all mutate this LOCAL array only; reorder is
 * a classic `@dnd-kit/core` 6.3.1 sortable (the `section-list-row.tsx` idiom) with a
 * chevron up/down fallback — NO per-drag server write, NO TanStack mutation (D-14 /
 * Pitfall 4). `buildSettingsInput` strips the `key` so only `{ platform, url }`
 * persists. The whole array order is the display order, written on explicit Save.
 *
 * State split (CLAUDE.md): every field is LOCAL `useState`; only the ephemeral dirty
 * flag is mirrored into the Zustand `uiStore` (to arm the CMS-07 guard). No server
 * data is mirrored into Zustand — there is none to mirror (the seed comes from the
 * RSC owner read, passed as `initial`).
 *
 * WR-01: registers its save via `useRegisterActiveSave` so the dirty guard's "Save
 * and continue" performs a REAL settings save.
 *
 * Two-layer identity (SHARED-E): chrome tokens ONLY (Evergreen/Copper, Inter). No
 * scoped template token, no inline color literal. The classic dnd-kit imports are
 * VERBATIM from `section-list-row.tsx` — the @dnd-kit/core 6.3.1 sortable preset, NOT
 * the incompatible newer react-binding API.
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
import { ChevronDown, ChevronUp, Globe, GripVertical, Link, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { CharCounter } from '@/components/ui/char-counter';
import { Input } from '@/components/ui/input';
import { UrlInput } from './url-input';
import { saveSettingsAction, type SaveSettingsInput } from '@/lib/cms/save-settings-action';
import { SOCIAL_PLATFORMS } from '@/lib/validations';
import { useUIStore } from '@/lib/stores/uiStore';

import { FormPanelHeader } from './form-panel-header';
import type { SaveState } from './save-button';
import { useRegisterActiveSave } from './unsaved-guard';

/**
 * Zod `.max(...)` bounds, mirrored from settings.ts (no magic numbers). `email_public`
 * uses the existing `settingsSchema.email_public` 320 cap; location/phone use the new
 * `contactSocialsSettingsSchema` caps (LOCATION_MAX 120 / PHONE_MAX 40).
 */
const EMAIL_MAX = 320;
const LOCATION_MAX = 120;
const PHONE_MAX = 40;

const GENERIC_ERROR = 'Something went wrong saving your changes. Please try again.';
/** ~2.2s success-beat hold (UI-SPEC Motion "saved & live"). */
const SAVED_BEAT_MS = 2200;
/** A stable per-list DndContext id (one Contact panel per dashboard ⇒ constant is unique). */
const SOCIALS_DND_ID = 'contact-socials-dnd';
/** The default platform a freshly-added blank row picks. */
const DEFAULT_PLATFORM: (typeof SOCIAL_PLATFORMS)[number] = 'website';

/** Human-readable labels for the curated platform enum (the picker option text). */
const PLATFORM_LABELS: Record<(typeof SOCIAL_PLATFORMS)[number], string> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  x: 'X',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  dribbble: 'Dribbble',
  behance: 'Behance',
  facebook: 'Facebook',
  threads: 'Threads',
  website: 'Website',
};

/**
 * One in-form social row. `key` is a CLIENT-ONLY synthetic id (the React/dnd key) —
 * NEVER persisted (D-15); `buildSettingsInput` strips it before the action call.
 */
export interface SocialRow {
  key: string;
  platform: string;
  url: string;
}

/** A persisted social entry (the shape the action writes) — exactly platform + url. */
type PersistedSocial = { platform: string; url: string };

/** Mint a fresh client-only key (crypto.randomUUID is available in every target). */
function mintKey(): string {
  return crypto.randomUUID();
}

/**
 * Reorder the in-form socials list (SET-02 / D-14) — a pure `arrayMove` over LOCAL
 * state. Both the dnd-kit drag and the chevron fallback ride this; the persisted
 * order is the array order on explicit Save (NO per-drag server write). `from === to`
 * (or an out-of-range index) is a safe identity. Exported so the unit suite can pin
 * the order-preservation render-free.
 */
// SET-02 / D-14
export function reorderSocialRows(rows: SocialRow[], from: number, to: number): SocialRow[] {
  if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) {
    return rows;
  }
  return arrayMove(rows, from, to);
}

/** The args `buildSettingsInput` maps to a `SaveSettingsInput`. */
export interface BuildSettingsInputArgs {
  emailPublic: string;
  location: string;
  phone: string;
  rows: SocialRow[];
  username?: string;
}

/**
 * Build the `saveSettingsAction` payload (D-15). STRIPS the client-only `key` so only
 * `{ platform, url }` persists, and maps an empty-string email/location/phone to
 * `undefined` (mirrors profile-form's undefined-on-empty — the action then normalizes
 * to '' / null, D-10). Pure (no I/O) so the unit suite pins the key-strip + normalize.
 */
// D-15
export function buildSettingsInput({
  emailPublic,
  location,
  phone,
  rows,
  username,
}: BuildSettingsInputArgs): SaveSettingsInput {
  const socials: PersistedSocial[] = rows.map(({ platform, url }) => ({
    platform: platform as PersistedSocial['platform'],
    url,
  }));
  return {
    email_public: emailPublic.trim() === '' ? undefined : emailPublic,
    socials: socials as SaveSettingsInput['socials'],
    location: location.trim() === '' ? undefined : location,
    phone: phone.trim() === '' ? undefined : phone,
    username,
  };
}

/** Normalize the RSC-seeded socials (an opaque JSONB value) into typed in-form rows. */
function seedRows(socials: ContactSocialsFormProps['initial']['socials']): SocialRow[] {
  if (!Array.isArray(socials)) return [];
  return socials
    .map((entry) => {
      const e = entry as { platform?: unknown; url?: unknown } | null;
      const platform = typeof e?.platform === 'string' ? e.platform : '';
      const url = typeof e?.url === 'string' ? e.url : '';
      return { key: mintKey(), platform: platform || DEFAULT_PLATFORM, url };
    });
}

export interface ContactSocialsFormProps {
  /** The owner's current contact/social values (RSC-loaded; the seed source). */
  initial: {
    email_public: string | null;
    /** The persisted socials JSONB array (opaque at the prop boundary; normalized here). */
    socials: PersistedSocial[] | null;
    location: string | null;
    phone: string | null;
  };
  /** The owner's username — passed so the action's revalidate needs no round-trip. */
  username?: string;
}

export function ContactSocialsForm({ initial, username }: ContactSocialsFormProps) {
  const setDirty = useUIStore((s) => s.setDirty);

  const [emailPublic, setEmailPublic] = useState(initial.email_public ?? '');
  const [location, setLocation] = useState(initial.location ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  // The socials list — { key, platform, url }[]; key is client-only (D-15).
  const [rows, setRows] = useState<SocialRow[]>(() => seedRows(initial.socials));

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const dirty = saveState === 'dirty' || saveState === 'saving';

  // Mirror the dirty flag into the Zustand UI store (arms the CMS-07 guard).
  useEffect(() => {
    setDirty(saveState === 'dirty');
  }, [saveState, setDirty]);

  // Re-settle the success beat back to idle after ~2.2s.
  useEffect(() => {
    if (saveState !== 'saved') return;
    const t = setTimeout(() => setSaveState('idle'), SAVED_BEAT_MS);
    return () => clearTimeout(t);
  }, [saveState]);

  /** Mark the panel dirty on any field/list change (unless mid-save). */
  const markDirty = useCallback(() => {
    setSaveState((s) => (s === 'saving' ? s : 'dirty'));
  }, []);

  const buildInput = useMemo(
    () =>
      function build(): SaveSettingsInput {
        return buildSettingsInput({ emailPublic, location, phone, rows, username });
      },
    [emailPublic, location, phone, rows, username],
  );

  const doSave = useCallback(async (): Promise<{ ok: boolean }> => {
    if (saveState === 'saving') return { ok: false };

    setFieldErrors({});
    setBanner(null);
    setSaveState('saving');

    try {
      const result = await saveSettingsAction(buildInput());
      if (result.ok) {
        setSaveState('saved');
        return { ok: true };
      }
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      if (result.error) setBanner(result.error);
      setSaveState('dirty');
      return { ok: false };
    } catch {
      setBanner(GENERIC_ERROR);
      setSaveState('dirty');
      return { ok: false };
    }
  }, [saveState, buildInput]);

  // WR-01: register this panel's save so the dirty guard's "Save and continue"
  // performs a REAL settings save.
  useRegisterActiveSave(doSave);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await doSave();
  }

  // ── Socials list mutators (LOCAL state only — D-14). ──
  const addRow = useCallback(() => {
    setRows((prev) => [...prev, { key: mintKey(), platform: DEFAULT_PLATFORM, url: '' }]);
    markDirty();
  }, [markDirty]);

  const removeRow = useCallback(
    (key: string) => {
      setRows((prev) => prev.filter((r) => r.key !== key));
      markDirty();
    },
    [markDirty],
  );

  const updatePlatform = useCallback(
    (key: string, platform: string) => {
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, platform } : r)));
      markDirty();
    },
    [markDirty],
  );

  const updateUrl = useCallback(
    (key: string, url: string) => {
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, url } : r)));
      markDirty();
    },
    [markDirty],
  );

  // SET-02 / D-14: a drag (or chevron) reorders the LOCAL array via arrayMove.
  const moveRow = useCallback(
    (from: number, to: number) => {
      setRows((prev) => {
        const next = reorderSocialRows(prev, from, to);
        return next === prev ? prev : next;
      });
      markDirty();
    },
    [markDirty],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = rows.map((r) => r.key);

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) {
      const from = ids.indexOf(active.id as string);
      const to = ids.indexOf(over.id as string);
      moveRow(from, to);
    }
  }

  // Screen-reader narration for the socials reorder (a11y parity with the rail).
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up social link ${labelOf(rows, active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${labelOf(rows, active.id)} moved to position ${positionOf(ids, over.id)} of ${ids.length}.`
        : `${labelOf(rows, active.id)} is no longer over a drop position.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${labelOf(rows, active.id)} dropped at position ${positionOf(ids, over.id)} of ${ids.length}.`
        : `${labelOf(rows, active.id)} dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${labelOf(rows, active.id)} returned to its position.`,
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <FormPanelHeader title="Contact & Socials" dirty={dirty} saveState={saveState} />

      {banner ? <Alert variant="error">{banner}</Alert> : null}

      {/* ── Contact block: email · location · phone ─────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Input
            label="Public email"
            name="email_public"
            type="email"
            autoComplete="email"
            value={emailPublic}
            maxLength={EMAIL_MAX}
            helper="Public contact email shown on your portfolio."
            onChange={(e) => {
              setEmailPublic(e.target.value);
              markDirty();
            }}
            error={fieldErrors.email_public}
          />
          <div className="self-end">
            <CharCounter value={emailPublic} max={EMAIL_MAX} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Input
            label="Location"
            name="location"
            value={location}
            maxLength={LOCATION_MAX}
            helper={'Where you’re based — anything works, e.g. "Remote · GMT+1".'}
            onChange={(e) => {
              setLocation(e.target.value);
              markDirty();
            }}
            error={fieldErrors.location}
          />
          <div className="self-end">
            <CharCounter value={location} max={LOCATION_MAX} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Input
            label="Phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            maxLength={PHONE_MAX}
            helper="A contact number shown on your portfolio. Leave blank to hide it."
            onChange={(e) => {
              setPhone(e.target.value);
              markDirty();
            }}
            error={fieldErrors.phone}
          />
          <div className="self-end">
            <CharCounter value={phone} max={PHONE_MAX} />
          </div>
        </div>
      </div>

      {/* ── Socials block: the reorderable curated-platform list (SET-02 / D-14) ─ */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-foreground">Social links</p>

        {rows.length === 0 ? (
          <div className="rounded-md bg-surface-muted p-4">
            <p className="text-sm font-semibold text-foreground">No social links yet</p>
            <p className="mt-1 text-[13px] leading-tight text-muted-foreground">
              Add links to where people can find you — LinkedIn, a portfolio site,
              social profiles. Click <span className="font-semibold">Add link</span> to
              start.
            </p>
          </div>
        ) : (
          <DndContext
            id={SOCIALS_DND_ID}
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={{ announcements }}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2 rounded-md bg-surface-muted p-2">
                {rows.map((row, index) => (
                  <SocialRowItem
                    key={row.key}
                    row={row}
                    index={index}
                    total={rows.length}
                    fieldError={fieldErrors[`socials.${index}.url`]}
                    onPlatformChange={(platform) => updatePlatform(row.key, platform)}
                    onUrlChange={(url) => updateUrl(row.key, url)}
                    onRemove={() => removeRow(row.key)}
                    onMove={moveRow}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {/* Add-link affordance — the dashed full-width button idiom (section-list). */}
        <button
          type="button"
          onClick={addRow}
          className={
            'flex min-h-11 w-full items-center justify-center gap-2 rounded-md ' +
            'border-[1.5px] border-dashed border-border-strong bg-transparent ' +
            'px-4 py-3 text-sm font-semibold text-brand outline-none transition-colors ' +
            'hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 ' +
            'focus-visible:outline-ring motion-reduce:transition-none'
          }
        >
          <Plus aria-hidden="true" className="size-4" />
          Add link
        </button>
      </div>
    </form>
  );
}

interface SocialRowItemProps {
  row: SocialRow;
  index: number;
  total: number;
  fieldError?: string;
  onPlatformChange: (platform: string) => void;
  onUrlChange: (url: string) => void;
  onRemove: () => void;
  onMove: (from: number, to: number) => void;
}

/**
 * One sortable social row: a 44px drag handle (the `useSortable` activator) · a
 * labelled platform `<select>` over the curated enum (text label + a generic glyph,
 * Globe for `website`, Link otherwise — UI-SPEC Icon Strategy) · a `UrlInput` · the
 * chevron up/down reorder fallback · a 44px inline `Trash2` remove (no confirm —
 * removal is local state only, reversible until Save). Chrome tokens only.
 */
function SocialRowItem({
  row,
  index,
  total,
  fieldError,
  onPlatformChange,
  onUrlChange,
  onRemove,
  onMove,
}: SocialRowItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } =
    useSortable({ id: row.key });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const atTop = index <= 0;
  const atBottom = index >= total - 1;
  const platformLabel = PLATFORM_LABELS[row.platform as keyof typeof PLATFORM_LABELS] ?? row.platform;
  const PlatformGlyph = row.platform === 'website' ? Globe : Link;

  return (
    <li ref={setNodeRef} style={style} className="list-none">
      <div className="flex flex-col gap-2 rounded-sm border border-border bg-surface p-2 sm:flex-row sm:items-start">
        {/* 44px drag handle — the activator (keyboard: Space lifts → arrows → Space drops). */}
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`Reorder ${platformLabel} link (use arrow keys after pressing space)`}
          className={
            'flex size-11 shrink-0 cursor-grab items-center justify-center self-center ' +
            'text-muted-foreground outline-none hover:text-foreground ' +
            'focus-visible:outline-2 focus-visible:-outline-offset-2 ' +
            'focus-visible:outline-ring active:cursor-grabbing'
          }
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" className="size-5" />
        </button>

        {/* Platform picker — a labelled <select> over the curated enum. */}
        <div className="flex flex-col gap-2 sm:flex-1 sm:flex-row sm:items-start">
          <label className="flex shrink-0 flex-col gap-1 sm:w-44">
            <span className="text-sm font-semibold text-foreground">Platform</span>
            <span className="relative flex items-center">
              <PlatformGlyph
                aria-hidden="true"
                className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
              />
              <select
                value={row.platform}
                onChange={(e) => onPlatformChange(e.target.value)}
                aria-label={`Platform for link ${index + 1}`}
                className={
                  'h-11 w-full rounded-sm border border-border bg-surface pl-9 pr-3 text-base ' +
                  'text-foreground outline-none transition-colors focus-visible:border-border-strong ' +
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
                }
              >
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p]}
                  </option>
                ))}
              </select>
            </span>
          </label>

          {/* URL field — the http(s)-only UrlInput (the client mirror of the gate). */}
          <div className="flex-1">
            <UrlInput
              label="Link URL"
              value={row.url}
              onValueChange={onUrlChange}
              error={fieldError}
            />
          </div>
        </div>

        {/* Reorder fallback (chevrons) + inline remove. */}
        <div className="flex shrink-0 items-center self-center">
          <button
            type="button"
            aria-label={`Move ${platformLabel} link up`}
            aria-disabled={atTop || undefined}
            onClick={atTop ? undefined : () => onMove(index, index - 1)}
            className={
              'flex size-11 shrink-0 items-center justify-center rounded-sm outline-none ' +
              'transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 ' +
              'focus-visible:outline-ring motion-reduce:transition-none ' +
              (atTop ? 'cursor-default text-border-strong' : 'text-muted-foreground hover:text-foreground')
            }
          >
            <ChevronUp aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Move ${platformLabel} link down`}
            aria-disabled={atBottom || undefined}
            onClick={atBottom ? undefined : () => onMove(index, index + 1)}
            className={
              'flex size-11 shrink-0 items-center justify-center rounded-sm outline-none ' +
              'transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 ' +
              'focus-visible:outline-ring motion-reduce:transition-none ' +
              (atBottom
                ? 'cursor-default text-border-strong'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            <ChevronDown aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove this link`}
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
      </div>
    </li>
  );
}

/** Resolve a row's platform label from a dnd-kit id (announcement helper). */
function labelOf(rows: SocialRow[], id: string | number): string {
  const platform = rows.find((r) => r.key === id)?.platform ?? '';
  return PLATFORM_LABELS[platform as keyof typeof PLATFORM_LABELS] ?? 'link';
}

/** 1-based position of a key in the ordered list (announcement helper). */
function positionOf(ids: string[], id: string | number): number {
  return ids.indexOf(id as string) + 1;
}
