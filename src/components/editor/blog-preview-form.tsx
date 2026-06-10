'use client';

/**
 * BlogPreviewForm (13.2-06 / D-16) — the SHRUNK `blog_preview` section form: a
 * heading field + a shown-count number input. It is the editor finally given to the
 * `blog_preview` soft-enum type, which until now hit the form-LESS "no editor yet"
 * fall-through in `editor-shell.tsx` (D-19 deferred it to the blog engine).
 *
 * D-16 (auto-derived teaser): the manual `items[]` array in `blogPreviewContentSchema`
 * becomes LEGACY/FALLBACK — the homepage teaser auto-derives from the latest
 * published posts at render (13.2-05). This form therefore edits only `heading` +
 * `post_count`; it PRESERVES any existing `items[]` (and other content keys) on save
 * via `{ ...initialContent }` spread so an older record keeps its fallback data
 * untouched, then overlays the two edited fields.
 *
 * CMS-08 preserved: `blog_preview` stays a SECTION type — it saves via the existing
 * `saveSectionAction` path (Zod-gated server-side by `blogPreviewContentSchema`), no
 * Postgres migration. This is the same client-island-calls-server-action flow as
 * `section-form.tsx`.
 *
 * BUNDLE RULE (CLAUDE.md / D-25): imports NO validations barrel and NO template
 * registry module — the `.max(100)` heading bound is hand-mirrored from
 * `sections.ts` (no schema import). The SERVER re-parse inside `saveSectionAction`
 * stays the authoritative gate.
 *
 * Two-layer identity (SHARED-E): Evergreen & Copper PLATFORM-CHROME tokens only.
 *
 * Source: the form flow + dirty/save lifecycle from `section-form.tsx`.
 */
import { useCallback, useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { CharCounter } from '@/components/ui/char-counter';
import { Input } from '@/components/ui/input';
import { saveSectionAction } from '@/lib/cms/save-section-action';
import { useUIStore } from '@/lib/stores/uiStore';

import { FormPanelHeader } from './form-panel-header';
import type { SaveState } from './save-button';
import { useRegisterActiveSave } from './unsaved-guard';

/** Zod `.max(...)` bound, hand-mirrored from sections.ts:216 (no barrel import). */
const HEADING_MAX = 100;
/** A sensible UI cap for the shown-count number input (the schema only requires int). */
const COUNT_MAX = 12;
const COUNT_MIN = 1;

const GENERIC_ERROR = 'Something went wrong saving your changes. Please try again.';
/** ~2.2s success-beat hold (UI-SPEC Motion "saved & live"). */
const SAVED_BEAT_MS = 2200;

export interface BlogPreviewFormProps {
  sectionId: string;
  /** The section's current content (from TanStack Query — the source of truth). */
  initialContent: Record<string, unknown>;
  /** The owner's username, passed so the revalidate needs no extra round-trip. */
  username?: string;
}

export function BlogPreviewForm({ sectionId, initialContent, username }: BlogPreviewFormProps) {
  const setDirty = useUIStore((s) => s.setDirty);

  const [heading, setHeading] = useState(String(initialContent.heading ?? ''));
  const initialCount =
    typeof initialContent.post_count === 'number' ? initialContent.post_count : 3;
  const [postCount, setPostCount] = useState<number>(initialCount);

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

  function markDirty() {
    setSaveState((s) => (s === 'saving' ? s : 'dirty'));
  }

  /**
   * The canonical content save. Preserves the existing content (incl. any legacy
   * `items[]` fallback, D-16) and overlays the two edited fields, then runs the
   * server action and maps the result to the UI.
   */
  const doSave = useCallback(async (): Promise<{ ok: boolean }> => {
    if (saveState === 'saving') return { ok: false };

    setFieldErrors({});
    setBanner(null);
    setSaveState('saving');

    try {
      const result = await saveSectionAction({
        sectionId,
        type: 'blog_preview',
        // D-16: preserve legacy items[] + other keys; overlay heading + post_count.
        content: { ...initialContent, heading, post_count: postCount },
        username,
      });

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
  }, [saveState, sectionId, initialContent, heading, postCount, username]);

  // WR-01: register this panel's save so the dirty guard's "Save and continue"
  // performs a REAL save (and only navigates on a resolved ok save).
  useRegisterActiveSave(doSave);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await doSave();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <FormPanelHeader title="Blog teaser" dirty={dirty} saveState={saveState} />

      {banner ? <Alert variant="error">{banner}</Alert> : null}

      <p className="text-sm text-muted-foreground">
        Your latest published posts show automatically on your page. Choose the heading and
        how many appear.
      </p>

      <Input
        label="Heading"
        name="heading"
        value={heading}
        maxLength={HEADING_MAX}
        error={fieldErrors.heading}
        helper="The title shown above your latest posts (e.g. “From the blog”)."
        onChange={(e) => {
          setHeading(e.target.value);
          markDirty();
        }}
      />
      <CharCounter value={heading} max={HEADING_MAX} />

      <Input
        label="Posts to show"
        name="post_count"
        type="number"
        min={COUNT_MIN}
        max={COUNT_MAX}
        value={String(postCount)}
        error={fieldErrors.post_count}
        helper={`How many recent posts to display (1–${COUNT_MAX}).`}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          setPostCount(Number.isNaN(n) ? COUNT_MIN : n);
          markDirty();
        }}
      />
    </form>
  );
}
