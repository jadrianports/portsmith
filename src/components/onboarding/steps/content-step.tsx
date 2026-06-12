'use client';

/**
 * ContentStep (18-05 / UI-SPEC Surface 3 — Hero/About/Projects/Contact, coached).
 *
 * A THIN coached wrapper that embeds the REAL Phase-17 editor forms VERBATIM
 * (D-06/D-07/D-08; Hero folds in identity per D-10) and renders the step-level
 * coaching above them. The wizard's per-step coaching heading already lives on the
 * step CARD (the shell, 18-04) — this wrapper ONLY routes the right embedded form for
 * the step and (Hero) composes the identity fields above the hero SectionForm.
 *
 * CRITICAL (the load-bearing rule, D-06): this wrapper does NOT fork, re-spec, or
 * duplicate the forms. Every write goes through the SAME editor actions the dashboard
 * uses — `saveSectionAction` (via SectionForm / ItemManager) and `saveProfileAction`
 * (via the Hero identity fields) — on the AUTHENTICATED RLS path, NEVER service-role,
 * on the UNPUBLISHED portfolio. The per-field helpers / placeholders / "Example · tap
 * to clear" chip already on those forms (Phase-17 D-01/D-02) are inherited UNCHANGED;
 * the wrapper adds ZERO field-level copy.
 *
 *   - hero    → the Hero IDENTITY fields (avatar + display name + headline, D-10,
 *               reusing `image-uploader.tsx` + `save-profile-action.ts`) ABOVE the
 *               hero `section-form.tsx` (its heading + subheading).
 *   - about   → `section-form.tsx` (the bio).
 *   - projects→ `item-card.tsx` / `ItemManager` (the project items).
 *   - contact → `section-form.tsx` (the contact heading + subheading).
 *
 * Every content step is skippable (D-08): the shell footer offers "Skip for now" — the
 * seeded honestly-placeholder content stays and still looks fine. A step auto-hides
 * (D-09) when the chosen template marks that section `supported:false` — the shell
 * decides the visible subset; this wrapper just renders whichever step it is handed.
 *
 * TWO-LAYER IDENTITY (SHARED-E): chrome tokens ONLY (Evergreen/Copper, Inter); no
 * template token, no inline hex. The embedded forms already obey this; the only net
 * chrome here is the Hero identity-field labels (reused from the editor ProfileForm).
 */
import { useCallback, useEffect, useState } from 'react';

import { CharCounter } from '@/components/ui/char-counter';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { saveProfileAction } from '@/lib/cms/save-profile-action';
import { useUIStore } from '@/lib/stores/uiStore';

import { ImageUploader } from '@/components/editor/image-uploader';
import { ItemManager } from '@/components/editor/item-card';
import { SectionForm } from '@/components/editor/section-form';
import { FormPanelHeader } from '@/components/editor/form-panel-header';
import type { SaveState } from '@/components/editor/save-button';
import { useRegisterActiveSave } from '@/components/editor/unsaved-guard';

import type { OnboardingStep } from './index';

/** Zod `.max(...)` bounds, mirrored from profile.ts (no magic numbers — parity with ProfileForm). */
const DISPLAY_NAME_MAX = 100;
const HEADLINE_MAX = 500;

const GENERIC_ERROR = 'Something went wrong saving your changes. Please try again.';
/** ~2.2s success-beat hold (UI-SPEC Motion "saved & live") — parity with the editor forms. */
const SAVED_BEAT_MS = 2200;

/**
 * The content step a wrapper renders, plus the section row (`sectionId` + `content`)
 * the embedded form edits. Hero/about/contact route to `SectionForm`; projects routes
 * to `ItemManager`. The `publish` / `template` steps NEVER reach this wrapper (the
 * shell routes them to their own steps), so the type is narrowed to the four content
 * steps.
 */
export type ContentStepType = Extract<
  OnboardingStep,
  'hero' | 'about' | 'projects' | 'contact'
>;

export interface ContentStepSection {
  /** The section row id (the `sections` UUID) the embedded form writes through. */
  sectionId: string;
  /** The section's current content (the unpublished owner read — the source of truth). */
  content: Record<string, unknown>;
}

/** The Hero step's prefilled identity values (D-10) — the editor ProfileForm's subset. */
export interface ContentStepIdentity {
  displayName: string | null;
  headline: string | null;
  avatarUrl: string | null;
  /** Carried so the profile save's explicit allowlist preserves the résumé URL (never dropped). */
  resumeUrl: string | null;
}

export interface ContentStepProps {
  /** Which content step this is (hero/about/projects/contact). */
  step: ContentStepType;
  /** The section row the embedded form edits. */
  section: ContentStepSection;
  /** The owner's username — passed so each save's revalidate needs no round-trip. */
  username: string;
  /** Hero only (D-10): the prefilled identity values for the avatar + name + headline. */
  identity?: ContentStepIdentity;
}

export function ContentStep({ step, section, username, identity }: ContentStepProps) {
  // Projects → the real ItemManager (item cards, debounced auto-save, dnd reorder).
  if (step === 'projects') {
    return (
      <ItemManager
        type="projects"
        sectionId={section.sectionId}
        initialContent={section.content}
        username={username}
      />
    );
  }

  // Hero → the identity fields (D-10) ABOVE the hero SectionForm. About / Contact →
  // just the SectionForm. The embedded SectionForm carries its own helpers + the
  // seeded "Example · tap to clear" chip (Phase-17 D-01/D-02) — never re-specified.
  return (
    <div className="flex flex-col gap-6">
      {step === 'hero' ? <HeroIdentityFields username={username} identity={identity} /> : null}
      <SectionForm
        sectionId={section.sectionId}
        type={step /* 'hero' | 'about' | 'contact' — SimpleSectionType */}
        initialContent={section.content}
        username={username}
      />
    </div>
  );
}

/**
 * The Hero identity fold-in (D-10): the avatar (client crop→WebP via the editor
 * `ImageUploader`), the display name, and the headline — written through
 * `saveProfileAction` (the SAME explicit-column allowlist action the editor ProfileForm
 * uses, NEVER service-role). This is the editor ProfileForm's identity subset, lifted
 * so the wizard's Hero step folds the user's name + photo into the "introduce yourself"
 * moment alongside the hero heading/subheading SectionForm.
 *
 * The save lifecycle mirrors `profile-form.tsx` EXACTLY (SHARED-A consumer): not
 * optimistic — the FormPanelHeader holds "Saving…" until the action RESOLVES, then the
 * dirty flag clears and the saved-&-live beat fires. The uploader's client checks are
 * UX; the action's Zod re-parse is the real gate. The explicit allowlist preserves the
 * résumé URL (carried in via `identity.resumeUrl`) so saving identity here never drops it.
 */
function HeroIdentityFields({
  username,
  identity,
}: {
  username: string;
  identity?: ContentStepIdentity;
}) {
  const setDirty = useUIStore((s) => s.setDirty);

  const [displayName, setDisplayName] = useState(identity?.displayName ?? '');
  const [headline, setHeadline] = useState(identity?.headline ?? '');
  const [avatarUrl, setAvatarUrl] = useState(identity?.avatarUrl ?? '');
  // Avatar alt — collected by the uploader for a11y but NOT persisted (profiles has no
  // alt column; parity with the editor ProfileForm's local-only avatarAlt).
  const [avatarAlt, setAvatarAlt] = useState('');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const dirty = saveState === 'dirty' || saveState === 'saving';

  // Mirror the dirty flag into the Zustand UI store (arms the CMS-07 guard).
  useEffect(() => {
    setDirty(saveState === 'dirty');
  }, [saveState, setDirty]);

  // Re-settle the success beat back to idle after ~2.2s (parity with ProfileForm).
  useEffect(() => {
    if (saveState !== 'saved') return;
    const t = setTimeout(() => setSaveState('idle'), SAVED_BEAT_MS);
    return () => clearTimeout(t);
  }, [saveState]);

  function markDirty() {
    setSaveState((s) => (s === 'saving' ? s : 'dirty'));
  }

  /**
   * The identity save. Builds the SAME input the editor ProfileForm builds (the
   * explicit-column subset — display_name / headline / avatar_url, plus the carried
   * resume_url so it is never dropped) and runs `saveProfileAction`. Returns `{ ok }`
   * so the shell's dirty guard's "Save and continue" (WR-01) can branch on success.
   */
  const doSave = useCallback(async (): Promise<{ ok: boolean }> => {
    if (saveState === 'saving') return { ok: false };

    setFieldErrors({});
    setBanner(null);
    setSaveState('saving');

    try {
      const result = await saveProfileAction({
        display_name: displayName,
        headline: headline.trim() === '' ? undefined : headline,
        avatar_url: avatarUrl.trim() === '' ? undefined : avatarUrl,
        // Preserve the résumé URL across an identity save (the action's allowlist
        // would otherwise clear an omitted optional). undefined when never set.
        resume_url:
          identity?.resumeUrl && identity.resumeUrl.trim() !== ''
            ? identity.resumeUrl
            : undefined,
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
  }, [saveState, displayName, headline, avatarUrl, identity?.resumeUrl, username]);

  // WR-01: register this panel's save so the shell's dirty guard's "Save and continue"
  // performs a REAL identity save before navigating.
  useRegisterActiveSave(doSave);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await doSave();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <FormPanelHeader title="Your details" dirty={dirty} saveState={saveState} />

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
        label="Photo"
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
        // The persisted baseline so a replace/remove-before-save frees only unsaved
        // churn (the saved avatar is never freed here — parity with the editor; D-11).
        persistedValue={identity?.avatarUrl ?? ''}
      />
    </form>
  );
}
