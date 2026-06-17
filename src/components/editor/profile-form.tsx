'use client';

/**
 * ProfileForm island (04-UI-SPEC §1 Profile / Identity, CMS-02 / D-P4-05) — the
 * profile-edit form that wires the four editable identity fields to
 * `saveProfileAction`. This is the UI caller WR-02 adds: the action was fully built
 * + integration-tested (tests/integration/cms/profile-write.test.ts) but had no
 * user-reachable surface; EditorShell now renders this when the "Profile" rail
 * entry is selected.
 *
 * Fields (the explicit 4-column allowlist the action writes — NEVER `username`,
 * which the protected-columns trigger guards):
 *   - display_name (required, 1–100) — plain Input
 *   - headline     (optional, ≤500)  — plain Input (short tagline)
 *   - avatar_url   (optional http(s)) — ImageUploader (pick → crop → WebP, D-07)
 *   - resume_url   (optional http(s)) — ResumeUploader (pick → PDF upload, D-07/D-11)
 *
 * Both media slots are upload-only (D-07): the avatar is the generic ratio-aware
 * ImageUploader (Plan 02) and the résumé is the PDF-only ResumeUploader (Plan 04);
 * each emits a host-locked Storage URL via onUploaded/onValueChange and the existing
 * Save persists it. Replacing/clearing either deletes the prior Storage object in
 * `saveProfileAction`'s delete-on-replace leg (D-11/D-12), not here.
 *
 * Mirrors `section-form.tsx` EXACTLY for the save lifecycle (SHARED-A consumer):
 * the save is NOT optimistic — the SaveButton holds "Saving…" until the action
 * resolves; on `{ ok:true }` the dirty flag clears and the saved-&-live beat fires.
 * The uploaders' client checks are UX only; the action's Zod re-parse is the real
 * gate.
 *
 * WR-01: registers its save via `useRegisterActiveSave` so the dirty guard's
 * "Save and continue" performs a REAL profile save (and only navigates on a
 * resolved ok save). The Zustand `dirty` flag is the ephemeral UI state that arms
 * the CMS-07 guard; profile content is the server's, not mirrored here.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { CharCounter } from '@/components/ui/char-counter';
import { Input } from '@/components/ui/input';
import { saveProfileAction } from '@/lib/cms/save-profile-action';
import { useUIStore } from '@/lib/stores/uiStore';
import { notifyPreviewSaved } from '@/lib/stores/preview-save-signal';

import { FormPanelHeader } from './form-panel-header';
import { ImageUploader } from './image-uploader';
import { ResumeUploader } from './resume-uploader';
import type { SaveState } from './save-button';
import { useRegisterActiveSave } from './unsaved-guard';

/** Zod `.max(...)` bounds, mirrored from profile.ts (no magic numbers). */
const DISPLAY_NAME_MAX = 100;
const HEADLINE_MAX = 500;

const GENERIC_ERROR = 'Something went wrong saving your changes. Please try again.';
/** ~2.2s success-beat hold (UI-SPEC Motion "saved & live"). */
const SAVED_BEAT_MS = 2200;

export interface ProfileFormProps {
  /** The owner's current identity values (RSC-loaded; the source of truth). */
  initial: {
    display_name: string | null;
    headline: string | null;
    avatar_url: string | null;
    resume_url: string | null;
  };
  /** The owner's username — passed so the action's revalidate needs no round-trip. */
  username?: string;
}

export function ProfileForm({ initial, username }: ProfileFormProps) {
  const setDirty = useUIStore((s) => s.setDirty);

  const [displayName, setDisplayName] = useState(initial.display_name ?? '');
  const [headline, setHeadline] = useState(initial.headline ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url ?? '');
  // Avatar alt text — collected by the uploader for accessibility, but NOT persisted
  // here: `profiles.avatar_url` is a plain URL column with no alt column (the
  // about-section `about.avatar` JSONB slot, which DOES carry an alt refine, is a
  // separate slot edited elsewhere). Local-only so the uploader's required-alt UX
  // works; the field is not part of buildInput / saveProfileAction.
  const [avatarAlt, setAvatarAlt] = useState('');
  const [resumeUrl, setResumeUrl] = useState(initial.resume_url ?? '');

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

  /** Mark the panel dirty on any field change (unless mid-save). */
  function markDirty() {
    setSaveState((s) => (s === 'saving' ? s : 'dirty'));
  }

  const buildInput = useMemo(
    () =>
      function build() {
        return {
          display_name: displayName,
          headline: headline.trim() === '' ? undefined : headline,
          avatar_url: avatarUrl.trim() === '' ? undefined : avatarUrl,
          resume_url: resumeUrl.trim() === '' ? undefined : resumeUrl,
          username,
        };
      },
    [displayName, headline, avatarUrl, resumeUrl, username],
  );

  /**
   * The canonical profile save. Runs the server action, maps the result to the UI,
   * and returns `{ ok }` so the form submit AND the dirty guard's "Save and
   * continue" (WR-01) can branch on success.
   */
  const doSave = useCallback(async (): Promise<{ ok: boolean }> => {
    if (saveState === 'saving') return { ok: false };

    setFieldErrors({});
    setBanner(null);
    setSaveState('saving');

    try {
      const result = await saveProfileAction(buildInput());
      if (result.ok) {
        setSaveState('saved');
        // Phase 27 (EDIT-03/D-04): the profile identity (name/headline/avatar) renders
        // in the hero — reload the preview + re-scroll there. `null` if no hero exists
        // would just reload without a scroll; 'hero' is the natural identity anchor.
        notifyPreviewSaved('hero');
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
  // performs a REAL profile save.
  useRegisterActiveSave(doSave);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await doSave();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <FormPanelHeader title="Profile" dirty={dirty} saveState={saveState} />

      {banner ? <Alert variant="error">{banner}</Alert> : null}

      <div className="flex flex-col gap-1">
        <Input
          label="Display name"
          name="display_name"
          value={displayName}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="name"
          onChange={(e) => {
            setDisplayName(e.target.value);
            markDirty();
          }}
          error={fieldErrors.display_name}
        />
        <div className="self-end">
          <CharCounter value={displayName} max={DISPLAY_NAME_MAX} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Input
          label="Headline"
          name="headline"
          value={headline}
          maxLength={HEADLINE_MAX}
          helper="A short tagline shown under your name."
          onChange={(e) => {
            setHeadline(e.target.value);
            markDirty();
          }}
          error={fieldErrors.headline}
        />
        <div className="self-end">
          <CharCounter value={headline} max={HEADLINE_MAX} />
        </div>
      </div>

      <ImageUploader
        kind="avatar"
        label="Avatar"
        value={avatarUrl}
        onValueChange={(url) => {
          setAvatarUrl(url);
          markDirty();
        }}
        onUploaded={(url) => {
          setAvatarUrl(url);
          markDirty();
        }}
        alt={avatarAlt}
        onAltChange={setAvatarAlt}
        error={fieldErrors.avatar_url}
      />

      <ResumeUploader
        value={resumeUrl}
        onValueChange={(url) => {
          setResumeUrl(url);
          markDirty();
        }}
        onUploaded={(url) => {
          setResumeUrl(url);
          markDirty();
        }}
        error={fieldErrors.resume_url}
      />
    </form>
  );
}
