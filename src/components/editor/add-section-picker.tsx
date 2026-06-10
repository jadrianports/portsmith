'use client';

/**
 * AddSectionTypePicker (13.1-06 / UI-SPEC §3 / D-01 / D-02 / D-19) — the
 * focus-trapped, flat, profession-neutral type picker that provisions a new
 * section on demand (the EDIT-ALL provisioning affordance, SC-1).
 *
 * It lists every FORM-HAVING type the portfolio does NOT already have — including
 * `blog_preview` as of 13.2-06 / D-16 (it gained its BlogPreviewForm in the blog
 * engine). The list is a PLAIN, ordered, self-contained const (title + blurb +
 * lucide icon per the LOCKED D-19 map) — it does NOT import `@/lib/validations` or
 * `@/components/templates/registry`
 * (D-25: keep Zod/specs off the bundle; the addable set is a constant, not the
 * schema map). The server `addSectionAction` allowlist (`ADDABLE_SECTION_TYPES`)
 * is the authoritative backstop behind this client filter.
 *
 * Selecting a row fires `addSectionAction(type)`; while in-flight the row shows a
 * spinner + an `aria-live` "Adding {Type}…" announcement. On `{ ok:true }` the
 * dialog closes and `onAdded(sectionId, type)` lets the shell select + first-fill
 * the new section (D-21). On `{ ok:false }` (e.g. the 23505 race backstop) an
 * in-dialog destructive Alert shows and the dialog stays open. When no addable
 * type remains the body shows the calm "every type present" line.
 *
 * Surface = the focus-trapped chrome dialog idiom from `unsaved-guard.tsx`:
 * centered surface, `--radius-lg`, `--shadow-card`, backdrop scrim, `role="dialog"`
 * `aria-modal="true"` `aria-labelledby`, Esc closes, focus returns to the trigger
 * on close, the first addable row focused on open.
 *
 * TWO-LAYER ISOLATION (CLAUDE.md): PLATFORM CHROME only — Evergreen & Copper
 * `--color-*` tokens + `--font-sans` (Inter). No `.tmpl-*` reach, no inline hex.
 * The picker icons are `--color-foreground` (NOT the copper accent — accent stays
 * scarce: focus rings only on these surfaces).
 */
import {
  Award,
  Briefcase,
  ChartNoAxesColumn,
  FolderKanban,
  GraduationCap,
  HandHelping,
  Images,
  LoaderCircle,
  Mail,
  Newspaper,
  PanelTop,
  Quote,
  User,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { addSectionAction } from '@/lib/cms/add-section-action';

/**
 * The LOCKED D-19 picker entries — title + one-line blurb + lucide icon, in the
 * profession-neutral D-19 order. This is a PLAIN const string-keyed list, NOT the
 * Zod registry/schema map (D-25). `blog_preview` is now INCLUDED (13.2-06 / D-16) —
 * its form (heading + shown-count) shipped with the blog engine. The server
 * `ADDABLE_SECTION_TYPES` allowlist is the backstop.
 */
interface PickerEntry {
  type: string;
  title: string;
  blurb: string;
  Icon: LucideIcon;
}

const PICKER_ENTRIES: readonly PickerEntry[] = [
  {
    type: 'hero',
    title: 'Hero',
    blurb: 'Your headline intro at the top of the page.',
    Icon: PanelTop,
  },
  {
    type: 'about',
    title: 'About',
    blurb: 'A short bio — who you are and what you do.',
    Icon: User,
  },
  {
    type: 'projects',
    title: 'Projects',
    blurb: 'Work or showcase pieces you’re proud of.',
    Icon: FolderKanban,
  },
  {
    type: 'experience',
    title: 'Experience',
    blurb: 'Roles and work history, most recent first.',
    Icon: Briefcase,
  },
  {
    type: 'skills',
    title: 'Skills',
    blurb: 'Grouped competencies or tools.',
    Icon: Wrench,
  },
  {
    type: 'testimonials',
    title: 'Testimonials',
    blurb: 'Quotes and endorsements from others.',
    Icon: Quote,
  },
  {
    type: 'contact',
    title: 'Contact',
    blurb: 'How visitors get in touch.',
    Icon: Mail,
  },
  {
    type: 'education',
    title: 'Education',
    blurb: 'Degrees, programs, and courses.',
    Icon: GraduationCap,
  },
  {
    type: 'metrics',
    title: 'Metrics',
    blurb: 'Headline numbers and results (e.g. 10M+ reached).',
    Icon: ChartNoAxesColumn,
  },
  {
    type: 'services',
    title: 'Services',
    blurb: 'What you offer and how you can help.',
    Icon: HandHelping,
  },
  {
    type: 'moodboard',
    title: 'Moodboard / Gallery',
    blurb: 'A captioned image gallery, with an optional color palette.',
    Icon: Images,
  },
  {
    type: 'certifications',
    title: 'Certifications',
    blurb: 'Credentials, badges, and licenses.',
    Icon: Award,
  },
  {
    type: 'blog_preview',
    title: 'Blog teaser',
    blurb: 'Show your latest posts on your page (auto-filled from your blog).',
    Icon: Newspaper,
  },
] as const;

/** Copy (UI-SPEC §3 / Copywriting Contract — LOCKED). */
const COPY = {
  title: 'Add a section',
  close: 'Close',
  empty:
    'Every section type is already on your page. Remove one to free it up, or edit the ones you have.',
  error: 'We couldn’t add that section. Please try again.',
  adding: (title: string) => `Adding ${title}…`,
} as const;

export interface AddSectionTypePickerProps {
  /**
   * The section types ALREADY present on the portfolio — filtered OUT of the
   * addable list (you can't add a type you already have; the DB
   * `UNIQUE(portfolio_id, type)` is the backstop).
   */
  presentTypes: readonly string[];
  /** The owner's username, passed straight to `addSectionAction` for the revalidate. */
  username?: string;
  /** Close the dialog without adding (Esc / backdrop / the × button). */
  onClose: () => void;
  /**
   * Fired after a successful add so the shell can select + first-fill the new
   * section (D-21). The dialog closes itself first.
   */
  onAdded: (sectionId: string, type: string) => void;
}

/**
 * The focus-trapped Add-section picker dialog. Mount it only while open (the
 * trigger — the rail's dashed "Add section" button — controls mounting); it
 * returns focus to that trigger on unmount.
 */
export function AddSectionTypePicker({
  presentTypes,
  username,
  onClose,
  onAdded,
}: AddSectionTypePickerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Which type is currently being added (its row shows the spinner + aria-busy).
  const [adding, setAdding] = useState<string | null>(null);
  // The in-dialog destructive Alert message (the 23505 race backstop / failure).
  const [error, setError] = useState<string | null>(null);

  // The addable list = the D-19 entries (incl. blog_preview as of 13.2-06) MINUS
  // already-present types. A plain client-side filter; the server allowlist is the
  // authority.
  const present = useMemo(() => new Set(presentTypes), [presentTypes]);
  const addable = useMemo(
    () => PICKER_ENTRIES.filter((e) => !present.has(e.type)),
    [present],
  );

  // Remember the trigger; focus the first addable row on open; return focus on close.
  useEffect(() => {
    triggerRef.current = document.activeElement;
    const firstRow = dialogRef.current?.querySelector<HTMLElement>(
      'button[data-picker-row]',
    );
    // Fall back to the close button when there are no addable rows (empty state).
    const fallback = dialogRef.current?.querySelector<HTMLElement>(
      'button[data-picker-close]',
    );
    (firstRow ?? fallback)?.focus();
    return () => {
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, []);

  // Focus trap + Esc closes (the safe cancel). Mirrors the unsaved-guard idiom.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  async function handleSelect(entry: PickerEntry) {
    if (adding) return; // one add in-flight at a time.
    setError(null);
    setAdding(entry.type);
    const result = await addSectionAction(entry.type, username);
    if (result.ok) {
      // Close first (returns focus to the trigger via the cleanup effect), then
      // let the shell select + first-fill the freshly-added section (D-21).
      onAdded(result.sectionId, entry.type);
      return;
    }
    // {ok:false} — keep the dialog open + surface the generic destructive Alert.
    setAdding(null);
    setError(COPY.error);
  }

  const addingTitle =
    adding != null
      ? (PICKER_ENTRIES.find((e) => e.type === adding)?.title ?? adding)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !adding) onClose();
      }}
    >
      {/* Backdrop scrim (derived from --color-background per UI-SPEC Color). */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-foreground/40 transition-opacity duration-100 motion-reduce:transition-none"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-section-dialog-heading"
        onKeyDown={onKeyDown}
        style={{ fontFamily: 'var(--font-sans)' }}
        className={
          'font-sans relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden ' +
          'rounded-lg border border-border bg-surface shadow-card ' +
          'transition-[opacity,transform] duration-150 motion-reduce:transition-none'
        }
      >
        {/* Header — title + close. */}
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2
            id="add-section-dialog-heading"
            className="text-base font-semibold text-foreground"
          >
            {COPY.title}
          </h2>
          <button
            type="button"
            data-picker-close
            onClick={() => {
              if (!adding) onClose();
            }}
            disabled={adding != null}
            aria-label={COPY.close}
            className={
              'flex size-11 shrink-0 items-center justify-center rounded-sm ' +
              'text-muted-foreground outline-none transition-colors hover:text-foreground ' +
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ' +
              'disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none'
            }
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        {/* In-dialog error Alert (the 23505 race backstop / generic failure). */}
        {error ? (
          <div className="px-5 pt-4">
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive-bg p-3 text-sm text-destructive"
            >
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        {/* Body — the addable rows, or the calm empty line. */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {addable.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {COPY.empty}
            </p>
          ) : (
            <ul className="flex flex-col">
              {addable.map((entry, i) => {
                const isAdding = adding === entry.type;
                return (
                  <li
                    key={entry.type}
                    className={i > 0 ? 'border-t border-border' : undefined}
                  >
                    <button
                      type="button"
                      data-picker-row
                      onClick={() => handleSelect(entry)}
                      disabled={adding != null}
                      aria-busy={isAdding || undefined}
                      className={
                        'flex w-full items-center gap-3 rounded-md px-3 py-3 text-left outline-none ' +
                        'transition-colors hover:bg-surface-muted ' +
                        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring ' +
                        'disabled:cursor-not-allowed motion-reduce:transition-none'
                      }
                    >
                      {/* Icon tile — --color-foreground (NOT accent). */}
                      <span
                        aria-hidden="true"
                        className={
                          'flex size-10 shrink-0 items-center justify-center rounded-sm ' +
                          'bg-surface-muted text-foreground'
                        }
                      >
                        {isAdding ? (
                          <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" />
                        ) : (
                          <entry.Icon className="size-5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {entry.title}
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                          {entry.blurb}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Polite live region for the in-flight "Adding {Type}…" announcement. */}
        <span className="sr-only" role="status" aria-live="polite">
          {addingTitle ? COPY.adding(addingTitle) : ''}
        </span>
      </div>
    </div>
  );
}
