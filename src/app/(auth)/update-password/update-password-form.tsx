'use client';

/**
 * Update-password form island (02-UI-SPEC "Update password", AUTH-04).
 *
 * The client island inside the RSC update-password card. It runs on the RECOVERY
 * SESSION the Plan 04 `/auth/confirm?type=recovery` handler established. It collects
 * a new password (autocomplete `new-password`) plus a confirm field with a
 * client-side match check, then submits to the server action `updatePassword` (the
 * real gate — it re-parses the schema AND re-checks the recovery session server-side
 * before `updateUser`). Client validation here is UX only.
 *
 * Per UI-SPEC copy:
 *   - weak password  → "Password must be at least 8 characters." (the Zod message,
 *     surfaced as a field error from the action — or pre-empted client-side).
 *   - mismatch       → "Passwords don't match." (client-side only; never sent).
 * On success the form navigates to `/dashboard`. If the recovery session is missing
 * or expired, the action returns a generic banner ("reset link is invalid or has
 * expired") and the user re-requests from `/forgot-password`.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updatePassword, type UpdatePasswordFieldErrors } from '@/lib/auth/reset-actions';

const MISMATCH_MESSAGE = "Passwords don't match.";

export function UpdatePasswordForm() {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [fieldErrors, setFieldErrors] = useState<UpdatePasswordFieldErrors>({});
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFieldErrors({});
    setConfirmError(null);
    setBanner(null);

    // Client-side match check (UX) — never submitted; the server gate is the schema.
    if (password !== confirm) {
      setConfirmError(MISMATCH_MESSAGE);
      return;
    }

    setSubmitting(true);
    try {
      const result = await updatePassword({ password });

      if (result.ok) {
        router.push('/dashboard');
        router.refresh();
        return;
      }

      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      if (result.error) setBanner(result.error);
    } catch {
      setBanner('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {banner ? <Alert variant="error">{banner}</Alert> : null}

      <Input
        label="New password"
        type="password"
        name="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        helper="At least 8 characters."
      />

      <Input
        label="Confirm new password"
        type="password"
        name="confirm_password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={confirmError ?? undefined}
      />

      <Button type="submit" loading={submitting}>
        Update password
      </Button>
    </form>
  );
}
