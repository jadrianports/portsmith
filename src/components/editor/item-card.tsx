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
import { useCallback, useEffect, useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CharCounter } from '@/components/ui/char-counter';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { ChipInput } from './chip-input';
import { ExampleChip } from './example-chip';
import { ImageUploader } from './image-uploader';
import { SaveStatus } from './save-status';
import { UrlInput } from './url-input';
// D-20 (folds 08-REVIEW WR-04): the SHARED trailing-debounce + sequence-token +
// skip-invalid save hook (13.1-03). `isSaveableSnapshot` is its Zod-FREE structural
// pre-check — importing it here keeps this file BARREL-FREE (the prior
// `validateSectionContent` `@/lib/validations` import is REMOVED, improving the
// bundle per D-25 / T-13.1-04-BUNDLE).
import {
  isSaveableSnapshot,
  useDebouncedSectionSave,
} from './use-debounced-section-save';

// ---------------------------------------------------------------------------
// Item model (the GENERIC, profession-agnostic shape)
// ---------------------------------------------------------------------------

/**
 * The flat item-bearing section types (each stores `content.items[]`).
 *
 * The original three (`projects`/`experience`/`testimonials`) ship a bespoke
 * per-type expanded-field JSX block (images, chip input, date pair). The four
 * flat marketer/education types added in 13.1-04 (`education`/`metrics`/`services`/
 * `certifications`, D-09/D-10) are pure FLAT field sets, so they are driven by the
 * `FIELD_DESCRIPTORS` config map below (RESEARCH Open Q1 — a descriptor map keeps
 * adding 4 types LINEAR rather than ballooning the in-place JSX). Both kinds share
 * the SAME dnd-kit reorder + whole-section write + skip-invalid + destructive
 * remove-item contract (Pitfall 7 — no item table).
 */
export type ItemSectionType =
  | 'projects'
  | 'experience'
  | 'testimonials'
  | 'education'
  | 'metrics'
  | 'services'
  | 'certifications';

/** The four flat types driven by the FIELD_DESCRIPTORS map (vs the bespoke 3). */
type FlatItemSectionType = 'education' | 'metrics' | 'services' | 'certifications';

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

/**
 * Per-type item cap — mirrors each content schema's `z.array(...).max(N)` in
 * sections.ts (NO single magic `ITEMS_MAX = 20` driving every type, D-10): metrics
 * caps at 12 (`metricsContentSchema`), the rest at 20. The server `.max()` re-parse
 * inside `saveSectionAction` stays the authority — this is the inline UX bound.
 */
const ITEMS_MAX: Record<ItemSectionType, number> = {
  projects: 20,
  experience: 20,
  testimonials: 20,
  education: 20, // educationContentSchema.items.max(20)
  metrics: 12, // metricsContentSchema.items.max(12)  ← NOT 20
  services: 20, // servicesContentSchema.items.max(20)
  certifications: 20, // certificationsContentSchema.items.max(20)
};

/** The inner string-list (`achievements[]`/`deliverables[]`) bounds (sections.ts). */
const STRING_LIST_MAX_ITEMS = 10; // z.array(...).max(10)
const STRING_LIST_ENTRY_MAX = 200; // z.string().max(200)

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
      highlights: [],
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
  // ── 13.1-04 flat types (D-09/D-10) — blank() seeds the schema field keys ──
  education: {
    noun: 'qualification',
    addLabel: 'Add qualification',
    emptyLine: 'No education yet — add your first one.',
    blank: () => ({ id: nanoid(), degree: '', school: '', year: '', achievements: [] }),
  },
  metrics: {
    noun: 'metric',
    addLabel: 'Add metric',
    emptyLine: 'No metrics yet — add your first one.',
    blank: () => ({ id: nanoid(), value: '', label: '', icon: '' }),
  },
  services: {
    noun: 'service',
    addLabel: 'Add service',
    emptyLine: 'No services yet — add your first one.',
    blank: () => ({ id: nanoid(), title: '', description: '', icon: '', deliverables: [] }),
  },
  certifications: {
    noun: 'certification',
    addLabel: 'Add certification',
    emptyLine: 'No certifications yet — add your first one.',
    blank: () => ({ id: nanoid(), title: '', issuer: '', year: '', description: '', url: '' }),
  },
};

// ---------------------------------------------------------------------------
// Field-descriptor map for the 4 FLAT types (RESEARCH Open Q1 — keeps adding
// types linear instead of ballooning the in-place expanded-field JSX). Each
// descriptor is sourced VERBATIM from the matching Zod schema in sections.ts —
// the label is UI-SPEC §4, the `max`/`required` mirror the schema (the inline UX
// bound; the server re-parse stays the authority).
// ---------------------------------------------------------------------------

/**
 * A single flat field's render descriptor. D-02: the input/textarea variants carry
 * an optional `helper` (Caption via aria-describedby) + an `e.g.` `placeholder`
 * (copied VERBATIM from the UI-SPEC Copywriting table where the field is listed);
 * the Input/Textarea `error` prop supersedes the helper (never both).
 */
type FieldDescriptor =
  /** A single-line text Input. */
  | { key: string; label: string; primitive: 'input'; max: number; required: boolean; placeholder?: string; helper?: string }
  /** A multi-line Textarea + CharCounter. */
  | { key: string; label: string; primitive: 'textarea'; max: number; required: boolean; placeholder?: string; helper?: string }
  /** An http(s)-gated UrlInput (e.g. certifications.url). */
  | { key: string; label: string; primitive: 'url'; required: boolean }
  /** The inner string-list sub-field (achievements[]/deliverables[]). */
  | { key: string; label: string; primitive: 'string-list'; addLabel: string; itemNoun: string };

/**
 * Per-flat-type ordered field set — fields render top-to-bottom in this order.
 * Sourced verbatim from sections.ts (lines cited inline):
 *   education      — educationItemSchema      (degree/school req, year opt, achievements[] ≤10)
 *   metrics        — metricItemSchema         (value/label req, icon opt)
 *   services       — serviceItemSchema        (title req, description/icon opt, deliverables[] ≤10)
 *   certifications — certificationItemSchema  (title req, issuer/year/description opt, url http(s)-gated)
 */
const FIELD_DESCRIPTORS: Record<FlatItemSectionType, FieldDescriptor[]> = {
  education: [
    // D-02: helper + `e.g.` placeholder VERBATIM from the UI-SPEC Copywriting table.
    { key: 'degree', label: 'Degree or program', primitive: 'input', max: 150, required: true, helper: 'Your qualification or program.', placeholder: 'e.g. BA, Communications' },
    { key: 'school', label: 'School or institution', primitive: 'input', max: 150, required: true, helper: 'Where you earned it.', placeholder: 'e.g. University of Leeds' },
    { key: 'year', label: 'Year or range', primitive: 'input', max: 60, required: false, placeholder: 'e.g. 2016 – 2020' },
    {
      key: 'achievements',
      label: 'Highlights',
      primitive: 'string-list',
      addLabel: 'Add highlight',
      itemNoun: 'highlight',
    },
  ],
  metrics: [
    // D-02: helper + `e.g.` placeholder VERBATIM from the UI-SPEC Copywriting table.
    { key: 'value', label: 'Value', primitive: 'input', max: 40, required: true, helper: 'A short headline number.', placeholder: 'e.g. 10M+' },
    { key: 'label', label: 'What it measures', primitive: 'input', max: 120, required: true, helper: 'What the number measures.', placeholder: 'e.g. people reached' },
    { key: 'icon', label: 'Icon name (optional)', primitive: 'input', max: 60, required: false },
  ],
  services: [
    // D-02: helper + `e.g.` placeholder VERBATIM from the UI-SPEC Copywriting table.
    { key: 'title', label: 'Service name', primitive: 'input', max: 120, required: true, helper: 'What you offer, in plain words.', placeholder: 'e.g. Brand strategy' },
    { key: 'description', label: 'Description', primitive: 'textarea', max: 500, required: false, helper: 'A sentence on what it includes.', placeholder: 'e.g. Positioning, messaging, and a launch plan tailored to your stage.' },
    { key: 'icon', label: 'Icon name (optional)', primitive: 'input', max: 60, required: false },
    {
      key: 'deliverables',
      label: 'Deliverables',
      primitive: 'string-list',
      addLabel: 'Add deliverable',
      itemNoun: 'deliverable',
    },
  ],
  certifications: [
    { key: 'title', label: 'Certification', primitive: 'input', max: 150, required: true },
    { key: 'issuer', label: 'Issuer', primitive: 'input', max: 120, required: false },
    { key: 'year', label: 'Year', primitive: 'input', max: 60, required: false },
    { key: 'description', label: 'Description', primitive: 'textarea', max: 300, required: false },
    { key: 'url', label: 'Verification link', primitive: 'url', required: false },
  ],
};

// ---------------------------------------------------------------------------
// D-02 (UI-SPEC Surface 2 + Copywriting): per-field helper + `e.g.` placeholder for
// the BESPOKE types' fields (projects/experience), copied VERBATIM from the UI-SPEC
// Copywriting table. The flat types carry their guidance inline in FIELD_DESCRIPTORS
// above; the bespoke types' in-place fields read from this map. Helper = informational
// (aria-describedby/muted, the Input/Textarea `error` prop supersedes it); placeholder
// = the native `e.g.` example value. (Testimonials' fields are not in the UI-SPEC
// table, so they carry no helper — mirroring Plan 06's no-helper-when-absent rule.)
// ---------------------------------------------------------------------------
const ITEM_FIELD_GUIDANCE = {
  projectTitle: {
    helper: 'Name the piece of work or project.',
    placeholder: 'e.g. Mobile banking app redesign',
  },
  projectDescription: {
    helper: 'What it was, your role, and the result.',
    placeholder: 'e.g. Led the redesign that lifted activation 24%…',
  },
  experienceRole: {
    helper: 'Your title in the role.',
    placeholder: 'e.g. Senior Marketing Manager',
  },
  experienceCompany: {
    helper: 'Where you held it.',
    placeholder: 'e.g. Northwind Co.',
  },
} as const;

// ---------------------------------------------------------------------------
// D-01 (UI-SPEC Surface 1): the SEED sentinels for the item-ARRAY sections — the
// exact placeholder items `initialize_portfolio()` writes for a brand-new account
// (migration 006_enrich_bootstrap_placeholder.sql). The ExampleChip's contract is
// "present IFF the item card still holds UNTOUCHED seed values"; a seeded item is
// matched by BOTH its stable seed `id` (the migration writes `placeholder-1` /
// `placeholder-2` / `placeholder`; a user-added item gets a nanoid) AND its seed
// text still matching (equality, not substring — the instant any field diverges or
// the card is cleared, the chip vanishes and never returns). Only projects (2 items)
// + experience (1 item) are seeded as item cards; testimonials seeds an EMPTY array
// and education/metrics/services/certifications are not bootstrapped — so those never
// show the chip. If the seed copy in the migration changes, update these in lockstep
// (a drifted sentinel just means the chip stops showing — a safe, non-destructive
// degrade, never a wrong clear).
// ---------------------------------------------------------------------------
const ITEM_SEED_SENTINELS: Partial<Record<ItemSectionType, Record<string, Record<string, string>>>> = {
  projects: {
    'placeholder-1': {
      title: 'Your First Project',
      description:
        "Describe a project you're proud of — what it does, the problem it solves, and the role you played. A short, concrete story (what changed because of your work) lands better than a feature list.",
    },
    'placeholder-2': {
      title: 'A Second Project',
      description:
        "Add another piece of work that shows a different side of what you do — a different skill, a different kind of client, or a result you're especially proud of. Two strong examples already make a portfolio feel real.",
    },
  },
  experience: {
    placeholder: {
      company: 'Company Name',
      role: 'Your Role',
      description: 'Describe what you did here.',
    },
  },
};

/**
 * D-01 — does this item card STILL hold its untouched bootstrap seed? Matches on the
 * stable seed id first (a user-added item's nanoid can never collide), then requires
 * EVERY seed field to still equal the seed value (equality, not substring — an edited
 * field that merely starts with the seed is the user's). Any divergence → no chip.
 */
function itemHoldsUntouchedSeed(type: ItemSectionType, item: EditorItem): boolean {
  const seedsForType = ITEM_SEED_SENTINELS[type];
  if (!seedsForType) return false;
  const seed = seedsForType[String(item.id)];
  if (!seed) return false;
  return Object.entries(seed).every(([k, v]) => item[k] === v);
}

/** The four flat types render via the descriptor map (vs the bespoke 3). */
const FLAT_TYPES = new Set<ItemSectionType>(['education', 'metrics', 'services', 'certifications']);

function isFlatType(type: ItemSectionType): type is FlatItemSectionType {
  return FLAT_TYPES.has(type);
}

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
    case 'education': {
      const degree = str(item.degree);
      const school = str(item.school);
      if (degree && school) return `${degree} · ${school}`;
      return degree || school || 'Untitled qualification';
    }
    case 'metrics': {
      const value = str(item.value);
      const label = str(item.label);
      if (value && label) return `${value} — ${label}`;
      return value || label || 'Untitled metric';
    }
    case 'services':
      return str(item.title) || 'Untitled service';
    case 'certifications':
      return str(item.title) || 'Untitled certification';
  }
}

// WR-03: the per-type image-field map + the old-vs-new URL diff
// (`IMAGE_FIELDS` / `imageUrlsOf` / `droppedImageUrls`) used to live HERE and fed
// `saveSectionAction({ deleteUrls })`. The delete set is now recomputed ENTIRELY
// on the server (`@/lib/cms/section-media-diff` → `serverDroppedItemImageUrls`,
// called inside `saveSectionAction`) from the prior persisted content, so the
// client no longer computes or passes any delete hint. The diff functions had no
// other UX use, so they were removed to make the trust model unambiguous.

const SAVE_ERROR =
  'We couldn’t save your changes. Please try again.';
const REORDER_ERROR =
  'We couldn’t save the new order — it’s been put back. Please try again.';
/** ~2.2s saved-&-live beat hold (UI-SPEC Surface 4 / Motion "saved & live"). */
const SAVED_BEAT_MS = 2200;

// ---------------------------------------------------------------------------
// StringListField — the inner achievements[]/deliverables[] sub-field (D-10, NEW)
// ---------------------------------------------------------------------------

interface StringListFieldProps {
  label: string;
  /** "Add highlight" / "Add deliverable" (UI-SPEC §4 Copywriting). */
  addLabel: string;
  /** Singular noun for the remove `aria-label` ("highlight" / "deliverable"). */
  itemNoun: string;
  /** The current list (each entry ≤200, list ≤10 — sections.ts). */
  values: string[];
  /** Persist the whole next list (routes through the parent onPatch → whole-section save). */
  onChange: (next: string[]) => void;
  /** Disable while a section save is in flight. */
  disabled?: boolean;
  /**
   * Max entries (default 10 — achievements/deliverables). Experience `highlights`
   * caps at 8 (`experienceItemSchema`), so it passes `maxItems={8}` — otherwise the
   * client would let the owner add a 9th–10th entry that the server re-parse rejects,
   * silently failing the whole-section save.
   */
  maxItems?: number;
}

/**
 * A small vertical list of single-line Inputs, each ≤200 chars, bounded at 10 —
 * the `achievements[]` (education) / `deliverables[]` (services) inner string-list.
 * Each row carries a 44px `trash-2` remove; a dashed mini "Add {noun}" button mints
 * a new blank entry (the AddItemCard idiom at a smaller scale). NO drag-reorder for
 * these inner lists (they are short bullet lists, UI-SPEC §4). Chrome tokens only.
 */
function StringListField({
  label,
  addLabel,
  itemNoun,
  values,
  onChange,
  disabled,
  maxItems = STRING_LIST_MAX_ITEMS,
}: StringListFieldProps) {
  const atMax = values.length >= maxItems;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>

      {values.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {values.map((entry, i) => (
            // The list is index-keyed: entries are plain strings with no stable id,
            // and there is no reorder (only append/edit/remove-by-index), so the
            // index is a stable enough key for this short, non-sortable inner list.
            <li key={i} className="flex items-start gap-2">
              <Input
                label={`${label} ${i + 1}`}
                // The per-row label is for a11y only; the group heading above names
                // the field. Hide the visible per-row label to keep the list compact.
                value={entry}
                maxLength={STRING_LIST_ENTRY_MAX}
                disabled={disabled}
                onChange={(e) => {
                  const next = values.slice();
                  next[i] = e.target.value;
                  onChange(next);
                }}
                className="flex-1 [&>label]:sr-only"
              />
              <button
                type="button"
                onClick={() => onChange(values.filter((_, j) => j !== i))}
                disabled={disabled}
                aria-label={`Remove ${itemNoun}`}
                className={
                  'mt-0 flex size-11 shrink-0 items-center justify-center rounded-sm ' +
                  'text-muted-foreground outline-none hover:text-destructive ' +
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ' +
                  'disabled:cursor-not-allowed'
                }
              >
                <Trash2 aria-hidden="true" className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {atMax ? (
        <p className="text-[13px] leading-tight text-muted-foreground">
          You’ve added the maximum of {maxItems}.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => onChange([...values, ''])}
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
          {addLabel}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FlatItemFields — the descriptor-driven expanded fields for the 4 flat types
// ---------------------------------------------------------------------------

interface FlatItemFieldsProps {
  type: FlatItemSectionType;
  item: EditorItem;
  disabled: boolean;
  onPatch: (id: string, patch: Partial<EditorItem>) => void;
}

/**
 * Renders the flat type's field set from FIELD_DESCRIPTORS — input / textarea
 * (+ CharCounter) / http(s)-gated UrlInput / the inner string-list sub-field. Each
 * field's change routes through `onPatch` so it lands in the SAME whole-section
 * `saveSectionAction` write (Pitfall 7).
 */
function FlatItemFields({ type, item, disabled, onPatch }: FlatItemFieldsProps) {
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((e) => (typeof e === 'string' ? e : String(e))) : [];

  return (
    <>
      {FIELD_DESCRIPTORS[type].map((field) => {
        switch (field.primitive) {
          case 'input':
            return (
              <Input
                key={field.key}
                label={field.required ? `${field.label} (required)` : field.label}
                value={str(item[field.key])}
                maxLength={field.max}
                placeholder={field.placeholder}
                // D-02: helper (aria-describedby) + the `e.g.` placeholder above;
                // the Input's `error` prop supersedes the helper (never both).
                helper={field.helper}
                disabled={disabled}
                onChange={(e) => onPatch(item.id, { [field.key]: e.target.value })}
              />
            );
          case 'textarea':
            return (
              <Textarea
                key={field.key}
                label={field.label}
                value={str(item[field.key])}
                maxLength={field.max}
                placeholder={field.placeholder}
                // D-02: helper + `e.g.` placeholder (error supersedes helper).
                helper={field.helper}
                disabled={disabled}
                onChange={(e) => onPatch(item.id, { [field.key]: e.target.value })}
                trailing={<CharCounter value={str(item[field.key])} max={field.max} />}
              />
            );
          case 'url':
            return (
              <UrlInput
                key={field.key}
                label={field.label}
                value={str(item[field.key])}
                onValueChange={(v) => onPatch(item.id, { [field.key]: v })}
              />
            );
          case 'string-list':
            return (
              <StringListField
                key={field.key}
                label={field.label}
                addLabel={field.addLabel}
                itemNoun={field.itemNoun}
                values={strList(item[field.key])}
                disabled={disabled}
                onChange={(next) => onPatch(item.id, { [field.key]: next })}
              />
            );
        }
      })}
    </>
  );
}

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
  /** D-01: this card still holds UNTOUCHED bootstrap seed values (shows the chip). */
  seeded?: boolean;
  /** Apply a partial field change to this item, then persist the section. */
  onPatch: (id: string, patch: Partial<EditorItem>) => void;
  /** Remove this item, then persist the section (uses the confirm dialog). */
  onRemove: (id: string) => void;
  /** D-01: one-tap clear of this seeded card's fields → empty (the chip vanishes). */
  onClearSeed: (id: string) => void;
  /**
   * D-11: the LAST-SAVED baseline URLs for this item's image slots (the TanStack-cache
   * persisted values at mount), passed into the item-image ImageUploaders so the
   * free-on-replace targets only unsaved churn ('' when this item had no saved image).
   * `persistedImageValue` → the projects `image`; `persistedAvatarValue` → the
   * testimonials `avatar`. Each uploader gets ONLY its own field's baseline.
   */
  persistedImageValue?: string;
  persistedAvatarValue?: string;
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
  seeded = false,
  onPatch,
  onRemove,
  onClearSeed,
  persistedImageValue,
  persistedAvatarValue,
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

          {/* D-01: the "Example · tap to clear" chip on a SEEDED item card header,
              shown while the card still holds untouched bootstrap seed. One tap clears
              this card's fields to empty (then the D-02 helpers/placeholders show) and
              the chip vanishes; editing any field also vanishes it (the host stops
              passing `seeded`). Reuses the Plan-06 ExampleChip — never accent. */}
          {seeded ? (
            <ExampleChip onClear={() => onClearSeed(item.id)} />
          ) : null}

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
            {/* The 4 flat marketer/education types render via the descriptor map
                (D-10); the bespoke 3 keep their in-place blocks below. */}
            {isFlatType(type) ? (
              <FlatItemFields type={type} item={item} disabled={saving} onPatch={onPatch} />
            ) : null}

            {type === 'projects' ? (
              <>
                <Input
                  label="Title"
                  value={str(item.title)}
                  // D-02: helper + `e.g.` placeholder (UI-SPEC Copywriting table).
                  helper={ITEM_FIELD_GUIDANCE.projectTitle.helper}
                  placeholder={ITEM_FIELD_GUIDANCE.projectTitle.placeholder}
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
                  // D-02: helper + `e.g.` placeholder (error supersedes helper).
                  helper={ITEM_FIELD_GUIDANCE.projectDescription.helper}
                  placeholder={ITEM_FIELD_GUIDANCE.projectDescription.placeholder}
                  onChange={(e) => onPatch(item.id, { description: e.target.value })}
                  trailing={
                    <CharCounter value={str(item.description)} max={DESCRIPTION_MAX} />
                  }
                />
                {/* Project image (16:9) via the generic ImageUploader. It co-locates
                    the REQUIRED alt Input; both the URL and alt route through onPatch
                    so they land in the SAME whole-section saveSectionAction write
                    (Pitfall 7). The server alt refine (projectItemSchema.image_alt,
                    sections.ts:86-89) is the real gate. D-11: persistedValue is the
                    saved baseline for this item's image (the free-on-replace targets
                    only unsaved churn). */}
                <ImageUploader
                  kind="project"
                  label="Project image"
                  value={str(item.image)}
                  onValueChange={(url) => onPatch(item.id, { image: url })}
                  alt={str(item.image_alt)}
                  onAltChange={(a) => onPatch(item.id, { image_alt: a })}
                  persistedValue={persistedImageValue}
                />
                {/* CATEGORY-FIX: the project category pills (`tags[]`, ≤6 — the schema
                    already carried it + templates already render them as the category
                    pills above each card, e.g. "Web App · Creative", but the editor had
                    no input). A non-icon chip input (resolveIcons=false) so an arbitrary
                    label is never coerced toward a tech slug; capitalization is kept. */}
                <ChipInput
                  label="Categories"
                  values={Array.isArray(item.tags) ? (item.tags as string[]) : []}
                  onChange={(next) => onPatch(item.id, { tags: next })}
                  max={6}
                  resolveIcons={false}
                  entryMaxLength={40}
                  placeholder="Type a category, press Enter"
                  addHint="Short labels shown as pills (e.g. Web App, Creative)."
                  maxHint="Up to 6 categories"
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
                  // D-02: helper + `e.g.` placeholder (UI-SPEC Copywriting table).
                  helper={ITEM_FIELD_GUIDANCE.experienceRole.helper}
                  placeholder={ITEM_FIELD_GUIDANCE.experienceRole.placeholder}
                  onChange={(e) => onPatch(item.id, { role: e.target.value })}
                />
                <Input
                  label="Company"
                  value={str(item.company)}
                  // D-02: helper + `e.g.` placeholder (UI-SPEC Copywriting table).
                  helper={ITEM_FIELD_GUIDANCE.experienceCompany.helper}
                  placeholder={ITEM_FIELD_GUIDANCE.experienceCompany.placeholder}
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
                {/* HIGHLIGHTS-FIX: the per-role bullet list (`highlights[]`, ≤8 — the
                    schema already carried it + edgerunner-v2/blueprint already render
                    it, but the editor had no input). Reuses the StringListField idiom
                    (achievements/deliverables). Templates that don't render highlights
                    ignore the field, so this is additive + cross-template safe. */}
                <StringListField
                  label="Highlights"
                  addLabel="Add highlight"
                  itemNoun="highlight"
                  maxItems={8}
                  values={Array.isArray(item.highlights) ? (item.highlights as string[]) : []}
                  disabled={saving}
                  onChange={(next) => onPatch(item.id, { highlights: next })}
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
                {/* Author photo (1:1) via the SAME generic ImageUploader (D-01/D-02).
                    Wired even though Testimonials is hidden-by-default in the founder
                    seed (D-02, ~zero marginal cost). URL + co-located required alt
                    both route through onPatch into the whole-section write; the server
                    alt refine (testimonialItemSchema.avatar_alt, sections.ts:102-105)
                    is the real gate. */}
                <ImageUploader
                  kind="testimonial"
                  label="Author photo"
                  value={str(item.avatar)}
                  onValueChange={(url) => onPatch(item.id, { avatar: url })}
                  alt={str(item.avatar_alt)}
                  onAltChange={(a) => onPatch(item.id, { avatar_alt: a })}
                  // D-11: the saved avatar baseline (free-on-replace = unsaved churn only).
                  persistedValue={persistedAvatarValue}
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
  /** Whether the section is at its per-type item cap (disables the add affordance). */
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
        You’ve added the maximum of {ITEMS_MAX[type]} items.
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
  const [newItemId, setNewItemId] = useState<string | null>(null);
  // A reorder-specific error (rollback). A generic save error is derived from the
  // hook's `state === 'error'` below — these two are distinct copy (REORDER vs SAVE).
  const [reorderError, setReorderError] = useState<string | null>(null);

  // D-01: the per-item seeded-vs-touched flag set. Computed ONCE from the mounted
  // content (the cards that held the untouched bootstrap seed at load); a card's id is
  // removed from the set the instant any of its fields is edited or it is cleared — so
  // the chip vanishes on edit and never returns (the UI-SPEC "chip vanishes on edit"
  // rule). Stored as a Set of item ids (seeded-ness is a display concept, not content).
  const [seededIds, setSeededIds] = useState<Set<string>>(
    () => new Set(initialItems.filter((it) => itemHoldsUntouchedSeed(type, it)).map((it) => String(it.id))),
  );

  // D-11: the per-item LAST-SAVED image baseline, captured ONCE from the mounted
  // (TanStack-cache) content. Each item-image ImageUploader gets its item's saved URL
  // as `persistedValue`, so a replace/remove before save frees only unsaved churn (the
  // persisted object's churn is the server on-save diff's job — WR-03). Computed at
  // mount and never mutated (the baseline is "what was saved", not the live value). The
  // image field differs by type (projects → `image`, testimonials → `avatar`); both are
  // captured so each uploader gets its OWN correct baseline (a wrong baseline could
  // strand a still-referenced own object — T-17-11E; the own-folder guard is the final
  // backstop, but the precise baseline is the first gate).
  const persistedImageBaseline = useRef<Map<string, { image: string; avatar: string }>>(
    new Map(
      initialItems.map(
        (it) =>
          [
            String(it.id),
            {
              image: typeof it.image === 'string' ? it.image : '',
              avatar: typeof it.avatar === 'string' ? it.avatar : '',
            },
          ] as const,
      ),
    ),
  );
  /** Read a captured-at-mount image baseline for one item field ('' when never saved). */
  const baselineFor = useCallback(
    (id: string, field: 'image' | 'avatar'): string =>
      persistedImageBaseline.current.get(String(id))?.[field] ?? '',
    [],
  );

  // D-04/D-05: the saved-&-live BEAT window. `onSavedAndLive` fires ONLY on the latest
  // resolved `{ ok: true }` (never-claim-live-early); we open a ~2.2s window during
  // which SaveStatus reads "Saved — your page is live" (the dopamine beat the explicit
  // model already fires), then settle it back so the line rests at "Saved". The hook
  // owns the timing of the FIRE; this window owns the visible HOLD (the explicit model
  // uses the same SAVED_BEAT_MS settle).
  const [live, setLive] = useState(false);

  // D-20 (folds 08-REVIEW WR-04 at its PRIMARY site): the SHARED save hook owns the
  // monotonic sequence-token stale-drop (Pitfall 7), the Zod-FREE skip-invalid
  // pre-check (Pitfall 8), and the saving/saved/error lifecycle — the per-keystroke
  // immediate save that used to live in `persist` is REPLACED. Field edits debounce
  // (`scheduleSave`); add/remove/reorder stay IMMEDIATE (`immediateSave`).
  const { state, scheduleSave, immediateSave } = useDebouncedSectionSave({
    sectionId,
    type,
    username,
    // D-04: bring the saved-&-live beat to the auto-save model (parity with the
    // explicit model) — open the beat window on the latest resolved-ok save.
    onSavedAndLive: () => setLive(true),
  });

  // D-04: settle the beat window back after ~2.2s (the explicit model's SAVED_BEAT_MS),
  // so "Saved — your page is live" relaxes to the resting "Saved".
  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => setLive(false), SAVED_BEAT_MS);
    return () => clearTimeout(t);
  }, [live]);

  const saving = state === 'saving';
  // The hook's error state drives the generic save Alert; the reorder path raises
  // its own (REORDER_ERROR) on a confirmed real failure (not a skip-invalid).
  const error = reorderError ?? (state === 'error' ? SAVE_ERROR : null);

  /** Build the WHOLE next content (Pitfall 7 — mutate `content.items`, never an item
   *  table). The server re-parses + recomputes dropped media (WR-03) on save. */
  const buildContent = useCallback(
    (nextItems: EditorItem[]) => ({ ...initialContent, items: nextItems }),
    [initialContent],
  );

  /**
   * Whether an `immediateSave` `{ ok: false }` was a SKIP (structurally invalid →
   * no network call) vs a REAL failure. The hook returns `{ ok: false }` for both;
   * `isSaveableSnapshot` (its own Zod-FREE pre-check, the same one the hook applies)
   * disambiguates so a reorder over a transient-invalid section does NOT raise the
   * misleading REORDER_ERROR (WR-04 skip-vs-fail distinction, preserved).
   */
  const wasSkippedInvalid = useCallback(
    (content: unknown) => !isSaveableSnapshot(type, content),
    [type],
  );

  /** Add a fresh blank item (expanded), then save IMMEDIATELY (discrete action). */
  async function add() {
    if (items.length >= ITEMS_MAX[type]) return;
    const blank = cfg.blank();
    const next = [...items, blank];
    setItems(next);
    setNewItemId(blank.id);
    setReorderError(null);
    await immediateSave(buildContent(next));
  }

  /**
   * Apply a partial field change to one item, then SCHEDULE a debounced save (D-20):
   * a keystroke burst coalesces into ONE `saveSectionAction` (one DB UPDATE / one
   * history row / one revalidate). This is the WR-04 `save-section-debounce` site —
   * the per-patch immediate save is replaced by the shared trailing debounce. A
   * REPLACED/CLEARED image is freed server-side on save (the server diff — WR-03).
   */
  function patch(id: string, p: Partial<EditorItem>) {
    const next = items.map((it) => (it.id === id ? { ...it, ...p } : it));
    setItems(next);
    setReorderError(null);
    // D-01: editing ANY field of a seeded card makes it "theirs" — the ExampleChip
    // vanishes immediately and never returns (the "chip vanishes on edit" rule).
    if (seededIds.has(String(id))) {
      setSeededIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(String(id));
        return nextSet;
      });
    }
    scheduleSave(buildContent(next));
  }

  /**
   * D-01 — the one-tap clear of a SEEDED card. Resets the card's fields to the SAME
   * empty state a freshly-added item shows (a fresh `blank()`, but KEEPING this card's
   * id so its position/key are stable), removes the chip, and SCHEDULES a debounced
   * save of the now-empty card (the cleared block is an unsaved change). The card then
   * shows the D-02 helpers/placeholders. No confirm (clearing example data is safe +
   * re-addable). Mirrors `section-form.tsx`'s `clearExample` for the item case.
   */
  function clearSeed(id: string) {
    const next = items.map((it) =>
      it.id === id ? ({ ...cfg.blank(), id: it.id } as EditorItem) : it,
    );
    setItems(next);
    setReorderError(null);
    setSeededIds((prev) => {
      const nextSet = new Set(prev);
      nextSet.delete(String(id));
      return nextSet;
    });
    scheduleSave(buildContent(next));
  }

  /** Remove an item, then save IMMEDIATELY (discrete action). If the removed item had
   *  an image, its prior Storage object is freed server-side on save (WR-03). */
  async function remove(id: string) {
    const next = items.filter((it) => it.id !== id);
    setItems(next);
    setReorderError(null);
    await immediateSave(buildContent(next));
  }

  // Reorder is OPTIMISTIC (SHARED-C, the only optimistic item op): flip the local
  // order instantly, save IMMEDIATELY, roll back on a confirmed failure + announce.
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
    setReorderError(null);
    const content = buildContent(next);
    // Reorder preserves the SAME items (and image URLs) — the server diff drops
    // nothing, so no delete fires (no false deletes on a reorder).
    void immediateSave(content).then((result) => {
      if (result.ok) return; // 'saved' → nothing to do.
      // The hook returns { ok:false } for BOTH a skip-invalid and a real failure.
      // 'skipped-invalid' (WR-04): the reorder itself is valid — only an unrelated
      // field (e.g. an item image awaiting its alt) is invalid, so the whole-section
      // save was skipped. Keep the optimistic order (it persists on the next valid
      // save) and do NOT raise the misleading REORDER_ERROR.
      if (wasSkippedInvalid(content)) return;
      setItems(previous); // a REAL failure → roll back to the truth (UI honesty)
      setReorderError(REORDER_ERROR);
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
      {/* D-04/D-05: the unified save-status line, fed the hook's `state` + the beat
          window, sits at the top of the manager (directly under the section <h2> the
          editor-shell wrapper renders) — so this auto-save model reads identically to
          the explicit Save model, the saved-&-live beat included. */}
      <SaveStatus state={state} live={live} />

      {error ? <Alert variant="error">{error}</Alert> : null}

      {items.length === 0 ? (
        <p className="text-[13px] leading-tight text-muted-foreground">
          {cfg.emptyLine}
        </p>
      ) : (
        <DndContext
          // Stable explicit id (see section-list-row.tsx): bypasses dnd-kit's
          // module-global useUniqueId counter so aria-describedby is hydration-stable.
          // Scoped to sectionId — exactly one ItemManager mounts per selected
          // item-section (SectionPanel keys by section id), so it is unique + stable.
          id={`item-dnd-${sectionId}`}
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
                  // D-01: the chip shows iff this card still holds untouched seed.
                  seeded={seededIds.has(String(item.id))}
                  onPatch={patch}
                  onRemove={remove}
                  onClearSeed={clearSeed}
                  // D-11: each uploader's own saved baseline (free-on-replace targets
                  // only unsaved churn; '' when this item's slot was never saved).
                  persistedImageValue={baselineFor(item.id, 'image')}
                  persistedAvatarValue={baselineFor(item.id, 'avatar')}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <AddItemCard
        type={type}
        atMax={items.length >= ITEMS_MAX[type]}
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
