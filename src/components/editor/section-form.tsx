'use client';

/**
 * SectionForm island (04-UI-SPEC §2 / §5, CMS-03) — the section editor form.
 *
 * The `'use client'` island that wires a simple section (hero / about / contact)
 * to `saveSectionAction`, mirroring `login-form.tsx`'s client-island-calls-server-
 * action flow EXACTLY: collect fields → on submit call the action → map
 * `result.fieldErrors` back to inputs and `result.error` to a form-level
 * `<Alert variant="error">` → on `{ ok: true }` clear dirty + fire the SaveButton
 * success beat.
 *
 * Inputs bind to the EXISTING Zod schemas via the soft-enum gate
 * (`validateSectionContent`) — client validation is UX only; the server action's
 * re-parse is the real gate (SHARED-D). CharCounter `max` values come straight
 * from the schemas (no magic numbers). URL fields use a plain Input placeholder
 * for now; 04-04 swaps in `UrlInput` once it lands.
 *
 * The content Save is NOT optimistic (UI-SPEC "optimistic UI honesty"): the
 * SaveButton shows "Saving…" until the action RESOLVES — the dirty flag clears
 * and "Saved — your page is live" appears ONLY on a resolved `{ ok: true }`,
 * never before the revalidate fires. The Zustand `dirty` flag is ephemeral UI
 * state (it arms the CMS-07 guard); section CONTENT lives in TanStack Query, never
 * mirrored here (CLAUDE.md non-overlap).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { CharCounter } from '@/components/ui/char-counter';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { saveSectionAction } from '@/lib/cms/save-section-action';
import { useUIStore } from '@/lib/stores/uiStore';

import { ExampleChip } from './example-chip';
import { FormPanelHeader } from './form-panel-header';
import type { SaveState } from './save-button';
import { useRegisterActiveSave } from './unsaved-guard';

/** The simple section types this form edits (hero / about / contact). CMS-03. */
export type SimpleSectionType = 'hero' | 'about' | 'contact';

/** Zod `.max(...)` bounds, mirrored from sections.ts (no magic numbers). */
const HEADING_MAX = 100;
const BIO_MAX = 2000;

const TITLES: Record<SimpleSectionType, string> = {
  hero: 'Hero',
  about: 'About',
  contact: 'Contact',
};

const GENERIC_ERROR = 'Something went wrong saving your changes. Please try again.';
/** ~2.2s success-beat hold (UI-SPEC Motion "saved & live"). */
const SAVED_BEAT_MS = 2200;

// D-01 (UI-SPEC Surface 1): the SEED sentinels — the exact placeholder values
// `initialize_portfolio()` writes for a brand-new account (migration
// 006_enrich_bootstrap_placeholder.sql). The ExampleChip's contract is "present
// IFF the block still holds UNTOUCHED seed values"; this is the content-sentinel
// that decides "untouched seed" — the block's current field values still match the
// seed AND the user has not edited anything. The instant any field diverges (an
// edit or a clear), the chip vanishes and never returns. If the seed copy in the
// migration changes, update these in lockstep (a drifted sentinel just means the
// chip stops showing — a safe, non-destructive degrade, never a wrong clear).
const SEED_SENTINELS: Record<
  SimpleSectionType,
  { heading?: string; subheading?: string; bio?: string }
> = {
  hero: {
    heading: "Hi, I'm [Your Name]",
    subheading: 'I build things for the web',
  },
  about: {
    bio: "I'm a professional who turns ideas into real, working results. Over the years I've learned that the details matter — clear communication, thoughtful execution, and following through on what I promise. This is the space to introduce yourself: share who you are, the kind of work you do, the problems you love to solve, and what makes working with you worthwhile. Keep it warm and specific — a couple of honest sentences beat a page of buzzwords.",
  },
  contact: {
    heading: 'Get in Touch',
    subheading: 'Have a question or want to work together? Send me a message.',
  },
};

/**
 * D-01 — does this block's current content STILL hold the untouched bootstrap seed?
 * Compares the section's field values against the seed sentinel for its type. Only
 * the fields this form edits are compared (hero/contact: heading+subheading; about:
 * bio); a missing/empty value or any divergence means "not the untouched seed" → no
 * chip. (Equality, not substring — an edited field that merely starts with the seed
 * is still the user's.)
 */
function holdsUntouchedSeed(
  type: SimpleSectionType,
  content: Record<string, unknown>,
): boolean {
  const seed = SEED_SENTINELS[type];
  if (type === 'about') {
    return content.bio === seed.bio;
  }
  // hero + contact compare heading + subheading.
  return content.heading === seed.heading && content.subheading === seed.subheading;
}

export interface SectionFormProps {
  sectionId: string;
  type: SimpleSectionType;
  /** The section's current content (from TanStack Query — the source of truth). */
  initialContent: Record<string, unknown>;
  /** The owner's username, passed so the revalidate needs no extra round-trip. */
  username?: string;
}

export function SectionForm({ sectionId, type, initialContent, username }: SectionFormProps) {
  const setDirty = useUIStore((s) => s.setDirty);

  // Field state — keyed per section type. Strings default to '' so the inputs are
  // controlled. (Hero: heading/subheading; About: bio; Contact: heading/subheading.)
  const [heading, setHeading] = useState(String(initialContent.heading ?? ''));
  const [subheading, setSubheading] = useState(String(initialContent.subheading ?? ''));
  const [bio, setBio] = useState(String(initialContent.bio ?? ''));

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // D-01 — the seeded-vs-touched flag (the UI-SPEC contract is: chip present IFF the
  // block still holds UNTOUCHED seed). Seeded-ness is a per-block CLIENT/display
  // concept: it starts true only if the section MOUNTED holding the bootstrap seed
  // sentinel, and flips PERMANENTLY false the instant the user edits any field or
  // taps clear — the chip + the rail "Example" tag then vanish and never return.
  const [showExample, setShowExample] = useState(() =>
    holdsUntouchedSeed(type, initialContent),
  );
  // The first editable field — focused after a one-tap clear so the user can start
  // typing immediately (UI-SPEC Surface 1 clear interaction).
  const firstFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  // A polite live region announcing "Example content cleared" (UI-SPEC Surface 1 /
  // Copywriting). Mounted only after a clear so it announces the change, not on load.
  const [clearAnnounce, setClearAnnounce] = useState(false);

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

  /** Mark the panel dirty on any field change (unless mid-save). */
  function markDirty() {
    setSaveState((s) => (s === 'saving' ? s : 'dirty'));
    // D-01: editing ANY field makes the block "theirs" — the example chip + rail tag
    // disappear immediately and do not return (the "chip vanishes on edit" rule).
    setShowExample(false);
  }

  /**
   * D-01 — the one-tap clear. Resets the block's seeded fields to the SAME empty
   * state a freshly-added section shows, removes the chip, marks the panel dirty
   * (the now-empty block is an unsaved change), moves focus to the first field, and
   * politely announces "Example content cleared". No confirm (clearing example data
   * is safe + re-addable).
   */
  function clearExample() {
    setHeading('');
    setSubheading('');
    setBio('');
    setShowExample(false);
    setSaveState((s) => (s === 'saving' ? s : 'dirty'));
    setClearAnnounce(true);
    // Move focus to the first field on the next frame (after the value reset paints).
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  }

  /** Assemble the section content payload for this type (the WHOLE content). */
  const buildContent = useMemo(
    () =>
      function build(): Record<string, unknown> {
        switch (type) {
          case 'hero':
            return { ...initialContent, heading, subheading };
          case 'about':
            return { ...initialContent, bio };
          case 'contact':
            return { ...initialContent, heading, subheading };
          default:
            return { ...initialContent };
        }
      },
    [type, initialContent, heading, subheading, bio],
  );

  /**
   * The canonical content save. Runs the server action, maps the result to the UI
   * (saved beat / field+banner errors), and returns `{ ok }` so callers (the form
   * submit AND the dirty guard's "Save and continue", WR-01) can branch on success.
   */
  const doSave = useCallback(async (): Promise<{ ok: boolean }> => {
    if (saveState === 'saving') return { ok: false };

    setFieldErrors({});
    setBanner(null);
    setSaveState('saving');

    try {
      const result = await saveSectionAction({
        sectionId,
        type,
        content: buildContent(),
        username,
      });

      if (result.ok) {
        // Resolved ok → clear dirty (Zustand) + fire the saved-&-live beat. Never
        // before the action resolves (the save is not optimistic).
        setSaveState('saved');
        return { ok: true };
      }

      // Failure: map field errors back to inputs, form-level error to the Alert,
      // and re-enable for retry (back to dirty). Nothing was published.
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      if (result.error) setBanner(result.error);
      setSaveState('dirty');
      return { ok: false };
    } catch {
      setBanner(GENERIC_ERROR);
      setSaveState('dirty');
      return { ok: false };
    }
  }, [saveState, sectionId, type, buildContent, username]);

  // WR-01: register this panel's save so the dirty guard's "Save and continue"
  // performs a REAL save (and only navigates on a resolved ok save).
  useRegisterActiveSave(doSave);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await doSave();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <FormPanelHeader
        title={TITLES[type]}
        dirty={dirty}
        saveState={saveState}
      />

      {/* D-01: the "Example · tap to clear" chip sits UNDER the form-panel header for
          a SIMPLE seeded section while the block still holds untouched seed. One tap
          clears the block to empty fields (showing the D-02 helpers/placeholders),
          moves focus to the first field, and announces the change. It is distinct
          from the D-02 helper ("here's what to type into this EMPTY field") and never
          co-present with seed values once cleared/edited. */}
      {showExample ? (
        <div>
          <ExampleChip onClear={clearExample} />
        </div>
      ) : null}

      {/* Polite announcement of the clear ("Example content cleared" — UI-SPEC
          Copywriting). Mounted only after a clear so it announces the change. */}
      <span aria-live="polite" className="sr-only">
        {clearAnnounce ? 'Example content cleared' : ''}
      </span>

      {banner ? <Alert variant="error">{banner}</Alert> : null}

      {(type === 'hero' || type === 'contact') && (
        <>
          <Textarea
            ref={firstFieldRef as React.Ref<HTMLTextAreaElement>}
            label="Heading"
            name="heading"
            value={heading}
            maxLength={HEADING_MAX}
            onChange={(e) => {
              setHeading(e.target.value);
              markDirty();
            }}
            error={fieldErrors.heading}
            trailing={<CharCounter value={heading} max={HEADING_MAX} />}
          />
          <Input
            label="Subheading"
            name="subheading"
            value={subheading}
            onChange={(e) => {
              setSubheading(e.target.value);
              markDirty();
            }}
            error={fieldErrors.subheading}
          />
        </>
      )}

      {type === 'about' && (
        <Textarea
          ref={firstFieldRef as React.Ref<HTMLTextAreaElement>}
          label="Bio"
          name="bio"
          value={bio}
          maxLength={BIO_MAX}
          onChange={(e) => {
            setBio(e.target.value);
            markDirty();
          }}
          error={fieldErrors.bio}
          trailing={<CharCounter value={bio} max={BIO_MAX} />}
        />
      )}
    </form>
  );
}
