'use client';

/**
 * HandleStep — the D-06 "Your URL" onboarding step (OAUTH-03 / D-04).
 *
 * The FIRST wizard step. A first-time user (especially an OAuth user, whose handle was
 * auto-derived by the `handle_new_user` trigger and may be suffixed — `johndoe7`) sees
 * their generated handle pre-filled and can confirm it or edit it before publishing. It
 * reuses the EXACT signup affordance: a username `<Input>` with the live debounced
 * `<UsernameAvailability>` adornment below it (the availability READ is anon-RLS,
 * unchanged — SHARED-E). Any change writes through the sanctioned
 * `setOnboardingUsernameAction` (SHARED-A → the `set_onboarding_username` RPC, D-06) —
 * NEVER a raw client UPDATE of the protected `username` column.
 *
 * SAVE-ON-CONTINUE (WR-01, mirrors ContentStep's HeroIdentityFields): the step registers
 * its save via `useRegisterActiveSave`, so the shell's "Continue" (a flush-THEN-move)
 * runs the handle write and advances ONLY on `{ ok: true }`; on a failure it stays and
 * surfaces the inline field error. If the handle is UNCHANGED from the trigger-assigned
 * baseline, the save is a no-op `{ ok: true }` (no write) — confirming the handle is free.
 *
 * TWO-LAYER IDENTITY (SHARED-E): chrome tokens ONLY (Evergreen/Copper, Inter); the
 * `Input` + `UsernameAvailability` primitives already obey this. Zero inline hex, zero
 * template-token reach; the Input is ≥44px with the chrome focus ring.
 *
 * Source: the username `<Input>` + conditional `<UsernameAvailability>` block from
 * signup-form.tsx (mirrored verbatim); the registered-save lifecycle from
 * content-step.tsx (HeroIdentityFields); the write action from
 * set-onboarding-username-action.ts (Task 1).
 */
import { useCallback, useEffect, useState } from 'react';

import { UsernameAvailability } from '@/components/auth/username-availability';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { useUIStore } from '@/lib/stores/uiStore';
import { useRegisterActiveSave } from '@/components/editor/unsaved-guard';
import { setOnboardingUsernameAction } from '@/lib/cms/set-onboarding-username-action';

const GENERIC_ERROR = 'Something went wrong saving your URL. Please try again.';

export interface HandleStepProps {
  /** The trigger-assigned handle (threaded by the RSC) — the pre-filled baseline. */
  username: string;
}

export function HandleStep({ username }: HandleStepProps) {
  const setDirty = useUIStore((s) => s.setDirty);

  // Pre-fill with the trigger-assigned handle. `baseline` is the last-known-good value
  // (the assigned handle, or a successfully-saved new one) — the no-write short-circuit
  // compares against it so an unchanged confirm never fires a write.
  const [handle, setHandle] = useState(username);
  const [baseline, setBaseline] = useState(username);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Mirror the dirty flag into the Zustand UI store (arms the CMS-07 beforeunload guard)
  // — dirty whenever the handle differs from the last-saved baseline.
  useEffect(() => {
    setDirty(handle.trim() !== baseline.trim());
  }, [handle, baseline, setDirty]);

  /**
   * The handle save (WR-01). If the handle is unchanged from the baseline it is a no-op
   * `{ ok: true }` (no write — confirming the assigned handle is free). Otherwise it
   * calls the sanctioned `setOnboardingUsernameAction`; on `{ ok: true }` it adopts the
   * new baseline + clears dirty; on `{ ok: false }` it surfaces the inline field error
   * (or the generic banner) and returns `{ ok: false }` so the shell STAYS on this step.
   */
  const doSave = useCallback(async (): Promise<{ ok: boolean }> => {
    if (saving) return { ok: false };

    const next = handle.trim();
    // Unchanged → no write (the assigned handle is already the caller's row value).
    if (next === baseline.trim()) return { ok: true };

    setFieldError(undefined);
    setBanner(null);
    setSaving(true);
    try {
      const result = await setOnboardingUsernameAction({ username: next });
      if (result.ok) {
        setBaseline(next);
        return { ok: true };
      }
      if (result.fieldErrors?.username) setFieldError(result.fieldErrors.username);
      else if (result.error) setBanner(result.error);
      else setBanner(GENERIC_ERROR);
      return { ok: false };
    } catch {
      setBanner(GENERIC_ERROR);
      return { ok: false };
    } finally {
      setSaving(false);
    }
  }, [saving, handle, baseline]);

  // WR-01: register this step's save so the shell's "Continue" performs the handle write
  // (or the no-op confirm) before advancing — and stays put on a failed write.
  useRegisterActiveSave(doSave);

  return (
    <div className="flex flex-col gap-4">
      {banner ? <Alert variant="error">{banner}</Alert> : null}

      <div>
        <Input
          label="Your URL"
          name="username"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value);
            // Clear a stale inline error the moment the user edits.
            if (fieldError) setFieldError(undefined);
            if (banner) setBanner(null);
          }}
          error={fieldError}
          helper="This is your portfolio address — change it if you like."
        />
        {/* Live availability — reused AS-IS (anon-RLS read), exactly as signup does.
            Suppressed while a format field-error is shown (mirrors signup-form). */}
        {!fieldError ? <UsernameAvailability value={handle} /> : null}
      </div>
    </div>
  );
}
