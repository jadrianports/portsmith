'use client';

/**
 * PageIdentityForm island (29 / D-01 / D-06, META-01..04) — the editor surface that
 * wires the four editable SEO / page-identity fields (`page_title`, `meta_description`,
 * `og_image_url`, `favicon_url`) to `saveSeoSettings`. This is the user-facing half of
 * Phase 29: the disjoint SEO write path (Plan 02) and the favicon/OG render path (Plan
 * 03) both already exist but had no reachable surface; `EditorShell` renders this when
 * the new "Page Identity & SEO" rail entry is selected (the 5th sentinel `activeSectionId`,
 * D-01).
 *
 * Mirrors `contact-socials-form.tsx` / `profile-form.tsx` EXACTLY for the save lifecycle
 * (SHARED-A consumer): the save is NOT optimistic — the SaveButton holds "Saving…" until
 * the action resolves; on `{ ok:true }` the dirty flag clears and the saved-&-live beat
 * fires. The ImageUploader client checks are UX only; `saveSeoSettings`'s Zod re-parse
 * (the CR-01 http(s)-only `og_image_url`/`favicon_url` gate) is the real boundary.
 *
 * D-06 revert (set-and-clear): clearing an ImageUploader posts `''` (its Remove →
 * onValueChange('')); `buildSeoAllowlist`'s `emptyToNull` turns that into stored `null`,
 * and the render-time ladders (D-04 favicon ladder, D-05 dynamic OG card) fall back to the
 * auto-generated default. A dedicated "Revert to auto-generated" affordance per image is
 * just a clear of the bound value.
 *
 * State split (CLAUDE.md): every field is LOCAL `useState`; only the ephemeral dirty flag
 * is mirrored into the Zustand `uiStore` (to arm the CMS-07 guard). No server data is
 * mirrored into Zustand — the seed comes from the RSC owner read, passed as `initial`.
 *
 * WR-01: registers its save via `useRegisterActiveSave` so the dirty guard's "Save and
 * continue" performs a REAL SEO save. On save it calls `notifyPreviewSaved(null)` — the
 * SEO fields are document-head metadata (title/description/favicon/og), NOT template-body,
 * so there is no section anchor to scroll to; `null` just reloads the preview.
 *
 * Two-layer identity (SHARED-E): chrome tokens ONLY (Evergreen/Copper, Inter). No scoped
 * `tmpl-*` template token, no inline color literal.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { UsernameAvailability } from '@/components/auth/username-availability';
import { Alert } from '@/components/ui/alert';
import { CharCounter } from '@/components/ui/char-counter';
import { Input } from '@/components/ui/input';
import { changeUsernameAction } from '@/lib/cms/change-username-action';
import { saveSeoSettings, type SaveSeoSettingsInput } from '@/lib/cms/save-settings-action';
import { setShowcaseOptIn } from '@/lib/cms/set-showcase-action';
import { THIRTY_DAYS_MS, formatNextAllowedDate } from '@/lib/cms/username-cooldown';
import { useUIStore } from '@/lib/stores/uiStore';
import { notifyPreviewSaved } from '@/lib/stores/preview-save-signal';

import { FormPanelHeader } from './form-panel-header';
import { ImageUploader } from './image-uploader';
import type { SaveState } from './save-button';
import { useRegisterActiveSave } from './unsaved-guard';

/** Zod `.max(...)` bounds, mirrored from settings.ts (no magic numbers). */
const PAGE_TITLE_MAX = 200;
const META_DESCRIPTION_MAX = 500;

const GENERIC_ERROR = 'Something went wrong saving your changes. Please try again.';
/** ~2.2s success-beat hold (UI-SPEC Motion "saved & live"). */
const SAVED_BEAT_MS = 2200;

export interface PageIdentityFormProps {
  /** The owner's current SEO / page-identity values (RSC-loaded; the seed source). */
  initial: {
    page_title: string | null;
    meta_description: string | null;
    og_image_url: string | null;
    favicon_url: string | null;
    /** SHOW-03 / D-07: the live Explore opt-in (a `profiles` column, default false). */
    showcase_opt_in: boolean;
  };
  /** The owner's username — passed so the action's revalidate needs no round-trip. */
  username?: string;
}

/** Chrome text-button (link) style — accent on hover only (two-layer rule: never a fill). */
const CHROME_LINK =
  'self-start rounded-sm px-1 text-[13px] font-semibold text-brand outline-none ' +
  'transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-ring motion-reduce:transition-none disabled:opacity-50';
/** Chrome confirm button — bordered/neutral (NO accent fill, NO inline hex). */
const CHROME_CONFIRM =
  'inline-flex items-center rounded-md border border-border bg-card px-3 py-1.5 text-[13px] ' +
  'font-semibold text-foreground outline-none transition-colors hover:bg-muted ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none';

/**
 * The username / vanity-URL control (HANDLE-01, D-07/D-08) — a SEPARATE sub-form inside
 * the Page Identity panel that calls `changeUsernameAction` (NOT `saveSeoSettings`): the
 * handle is the protected-column path with its own cooldown + 308-redirect, so it must
 * stay cleanly off the SEO save. D-08 two-step inline confirm: "Change URL" reveals the
 * input + warning copy; "Confirm new URL /{name}" commits. On a successful change (or a
 * cooldown denial) the control locks and shows the next-allowed date. The live
 * `UsernameAvailability` island gets `currentUsername` so the owner's own prior handle
 * reads as available (D-05 reclaim). Chrome single-layer only.
 */
function UsernameUrlField({ currentUsername }: { currentUsername: string }) {
  const [liveHandle, setLiveHandle] = useState(currentUsername);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentUsername);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  // Set on a successful change OR a cooldown denial — both carry the "…again on {date}"
  // copy. When set, the control is disabled (D-08 cooldown state).
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);

  const newName = value.trim();
  const isSame = newName === liveHandle;
  // The warning copy's upper-bound date (the action surfaces the precise one on denial).
  const warningDate = formatNextAllowedDate(Date.now() + THIRTY_DAYS_MS);
  const canConfirm = !pending && !isSame && newName.length >= 3 && available !== false;

  function startEditing() {
    setValue(liveHandle);
    setError(null);
    setFieldError(null);
    setAvailable(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setValue(liveHandle);
    setError(null);
    setFieldError(null);
    setAvailable(null);
  }

  async function confirm() {
    if (!canConfirm) return;
    setPending(true);
    setError(null);
    setFieldError(null);
    try {
      const result = await changeUsernameAction({ username: newName });
      if (result.ok) {
        setLiveHandle(newName);
        setEditing(false);
        setLockedMessage(
          `Changed. You can change your username again on ${formatNextAllowedDate(
            Date.now() + THIRTY_DAYS_MS,
          )}.`,
        );
        return;
      }
      if (result.fieldErrors?.username) setFieldError(result.fieldErrors.username);
      if (result.error) {
        setError(result.error);
        // A cooldown denial carries the dated "…change your username again on…" copy —
        // lock the control and surface it (D-08 cooldown-disabled state).
        if (/again on/i.test(result.error)) {
          setLockedMessage(result.error);
          setEditing(false);
        }
      }
    } catch {
      setError('Something went wrong changing your URL. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Your URL">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold text-foreground">Your URL</span>
        <p className="text-[13px] leading-tight text-muted-foreground">
          Your public address:{' '}
          <span className="font-medium text-foreground">/{liveHandle}</span>
        </p>
      </div>

      {lockedMessage ? (
        <p className="text-[13px] leading-tight text-muted-foreground" aria-live="polite">
          {lockedMessage}
        </p>
      ) : !editing ? (
        <button type="button" onClick={startEditing} className={CHROME_LINK}>
          Change URL
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <Input
            label="New username"
            name="new_username"
            value={value}
            maxLength={30}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
              setFieldError(null);
            }}
            error={fieldError ?? undefined}
          />
          <UsernameAvailability
            value={value}
            currentUsername={liveHandle}
            onAvailabilityChange={setAvailable}
          />
          {error ? <Alert variant="error">{error}</Alert> : null}
          <p className="text-[13px] leading-tight text-muted-foreground">
            Your URL becomes{' '}
            <span className="font-medium text-foreground">/{newName || '…'}</span>. Old links
            keep working via a redirect. You can change again on {warningDate}.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={confirm}
              disabled={!canConfirm}
              className={CHROME_CONFIRM}
            >
              {pending ? 'Changing…' : `Confirm new URL /${newName || ''}`}
            </button>
            <button type="button" onClick={cancel} disabled={pending} className={CHROME_LINK}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * The Explore opt-in toggle (SHOW-03 / D-06 / D-07) — a SEPARATE control inside the
 * Page Identity panel (both halves are "how your page is publicly identified &
 * discovered", D-07). Like the publish toggle, it is an IMMEDIATE write: on change it
 * calls `setShowcaseOptIn(value)` directly — NOT part of the SEO dirty-guard SaveButton
 * form (the SEO form writes the disjoint `portfolio_settings` table; `showcase_opt_in`
 * is a `profiles` column written by its own action). State is local `useState` seeded
 * from the owner read — never mirrored into Zustand (CLAUDE.md state split). Default off.
 * Chrome single-layer only (Evergreen/Copper `@theme` tokens + Inter; no template token,
 * no inline hex). On a failed write the checkbox reverts to its prior value.
 */
function ShowcaseOptInField({ initialOptedIn }: { initialOptedIn: boolean }) {
  const [optedIn, setOptedIn] = useState(initialOptedIn);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: boolean) {
    if (pending) return;
    setError(null);
    setPending(true);
    // Optimistic flip; revert on a non-ok result so the control reflects the truth.
    setOptedIn(next);
    try {
      const result = await setShowcaseOptIn(next);
      if (!result.ok) {
        setOptedIn(!next);
        setError(result.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setOptedIn(!next);
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Explore listing">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={optedIn}
          disabled={pending}
          onChange={(e) => handleChange(e.target.checked)}
          className="mt-0.5 size-4 rounded-sm border-border text-brand outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-foreground">
            Show my published portfolio on the public Explore page.
          </span>
          <span className="text-[13px] leading-tight text-muted-foreground">
            When on, your live portfolio can appear in the public Explore gallery. Off by default.
          </span>
        </span>
      </label>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </section>
  );
}

export function PageIdentityForm({ initial, username }: PageIdentityFormProps) {
  const setDirty = useUIStore((s) => s.setDirty);

  const [pageTitle, setPageTitle] = useState(initial.page_title ?? '');
  const [metaDescription, setMetaDescription] = useState(initial.meta_description ?? '');
  const [faviconUrl, setFaviconUrl] = useState(initial.favicon_url ?? '');
  const [ogImageUrl, setOgImageUrl] = useState(initial.og_image_url ?? '');
  // Throwaway local alt state for the image uploaders' required-alt UX. Neither the
  // favicon nor the OG column has an alt slot (they are bare URL columns), so this is
  // NOT persisted — it just satisfies the uploader's accessibility affordance (the
  // profile-form.tsx `avatarAlt` precedent).
  const [faviconAlt, setFaviconAlt] = useState('');
  const [ogAlt, setOgAlt] = useState('');

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
  const markDirty = useCallback(() => {
    setSaveState((s) => (s === 'saving' ? s : 'dirty'));
  }, []);

  // Build the action payload — empty-string → undefined (the buildSettingsInput idiom);
  // the action then normalizes to null via buildSeoAllowlist's emptyToNull (D-06).
  const buildInput = useMemo(
    () =>
      function build(): SaveSeoSettingsInput {
        return {
          page_title: pageTitle.trim() === '' ? undefined : pageTitle,
          meta_description: metaDescription.trim() === '' ? undefined : metaDescription,
          og_image_url: ogImageUrl.trim() === '' ? undefined : ogImageUrl,
          favicon_url: faviconUrl.trim() === '' ? undefined : faviconUrl,
          username,
        };
      },
    [pageTitle, metaDescription, ogImageUrl, faviconUrl, username],
  );

  const doSave = useCallback(async (): Promise<{ ok: boolean }> => {
    if (saveState === 'saving') return { ok: false };

    setFieldErrors({});
    setBanner(null);
    setSaveState('saving');

    try {
      const result = await saveSeoSettings(buildInput());
      if (result.ok) {
        setSaveState('saved');
        // SEO fields are document-head metadata (title/description/favicon/og), not a
        // template-body region — pass `null` to just reload the preview (no anchor scroll).
        notifyPreviewSaved(null);
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
  // performs a REAL SEO save.
  useRegisterActiveSave(doSave);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await doSave();
  }

  return (
    <div className="flex flex-col gap-8">
      <FormPanelHeader title="Page Identity &amp; SEO" dirty={dirty} saveState={saveState} />

      {/* HANDLE-01 / D-07: the username / vanity-URL control — a SEPARATE sub-form calling
          changeUsernameAction, cleanly off the SEO save below. */}
      <UsernameUrlField currentUsername={username ?? ''} />

      {/* SHOW-03 / D-07: the Explore opt-in toggle — an IMMEDIATE write via setShowcaseOptIn,
          cleanly off the SEO save below (both are "how your page is publicly discovered"). */}
      <ShowcaseOptInField initialOptedIn={initial.showcase_opt_in} />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {banner ? <Alert variant="error">{banner}</Alert> : null}

      {/* ── Text block: page title · meta description ─────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Input
            label="Page title"
            name="page_title"
            value={pageTitle}
            maxLength={PAGE_TITLE_MAX}
            helper={'The browser-tab title and search heading. Leave blank to use your name.'}
            onChange={(e) => {
              setPageTitle(e.target.value);
              markDirty();
            }}
            error={fieldErrors.page_title}
          />
          <div className="self-end">
            <CharCounter value={pageTitle} max={PAGE_TITLE_MAX} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Input
            label="Meta description"
            name="meta_description"
            value={metaDescription}
            maxLength={META_DESCRIPTION_MAX}
            helper={'The short summary search engines and link previews show under your title.'}
            onChange={(e) => {
              setMetaDescription(e.target.value);
              markDirty();
            }}
            error={fieldErrors.meta_description}
          />
          <div className="self-end">
            <CharCounter value={metaDescription} max={META_DESCRIPTION_MAX} />
          </div>
        </div>
      </div>

      {/* ── Favicon (browser-tab icon) — square; revert falls back to the D-04 ladder. ── */}
      <div className="flex flex-col gap-2">
        <ImageUploader
          kind="favicon"
          label="Favicon"
          value={faviconUrl}
          onValueChange={(url) => {
            setFaviconUrl(url);
            markDirty();
          }}
          onUploaded={(url) => {
            setFaviconUrl(url);
            markDirty();
          }}
          alt={faviconAlt}
          onAltChange={setFaviconAlt}
          error={fieldErrors.favicon_url}
        />
        {faviconUrl.trim() !== '' ? (
          <button
            type="button"
            onClick={() => {
              setFaviconUrl('');
              markDirty();
            }}
            className={
              'self-start rounded-sm px-1 text-[13px] font-semibold text-brand outline-none ' +
              'transition-colors hover:text-accent focus-visible:outline-2 ' +
              'focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none'
            }
          >
            Revert to auto-generated icon
          </button>
        ) : (
          <p className="text-[13px] leading-tight text-muted-foreground">
            No favicon set — your browser tab uses your avatar (or a generated initial).
          </p>
        )}
      </div>

      {/* ── Share image (1.91:1) — revert falls back to the dynamic per-portfolio card. ── */}
      <div className="flex flex-col gap-2">
        <ImageUploader
          kind="og"
          label="Share image"
          value={ogImageUrl}
          onValueChange={(url) => {
            setOgImageUrl(url);
            markDirty();
          }}
          onUploaded={(url) => {
            setOgImageUrl(url);
            markDirty();
          }}
          alt={ogAlt}
          onAltChange={setOgAlt}
          error={fieldErrors.og_image_url}
        />
        {ogImageUrl.trim() !== '' ? (
          <button
            type="button"
            onClick={() => {
              setOgImageUrl('');
              markDirty();
            }}
            className={
              'self-start rounded-sm px-1 text-[13px] font-semibold text-brand outline-none ' +
              'transition-colors hover:text-accent focus-visible:outline-2 ' +
              'focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none'
            }
          >
            Revert to auto-generated card
          </button>
        ) : (
          <p className="text-[13px] leading-tight text-muted-foreground">
            No share image set — links unfurl with an auto-generated card built from your portfolio.
          </p>
        )}
        </div>
      </form>
    </div>
  );
}
