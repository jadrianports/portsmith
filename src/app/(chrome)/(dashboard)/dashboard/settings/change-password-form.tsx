'use client';

/**
 * Change-password form island (ACCT-01, settings).
 *
 * The chrome client island wired to the reauth-gated `changePassword` server
 * action (the real gate — the client checks here are UX only). It collects the
 * current password (the D-01 reauth proof), the new password, and a confirm, then
 * submits `{ password, current_password }`. On `result.ok` the form clears and
 * shows an inline success Alert; on failure it surfaces the action's field/banner
 * errors (the reauth-failure generic `error` lands in the banner — never a silent
 * dead-end). Chrome tokens only (Inter, Evergreen/Copper); the Copper accent is
 * focus-ring/link-hover only, so the submit reuses the existing primary Button
 * fill, never an accent fill. No bespoke form primitive — Input/Button/Alert from
 * `@/components/ui/*`.
 */
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  changePassword,
  type ChangePasswordFieldErrors,
} from '@/lib/account/change-password-action';

const PASSWORDS_DONT_MATCH = 'The new passwords do not match';

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<ChangePasswordFieldErrors>({});
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFieldErrors({});
    setConfirmError(null);
    setBanner(null);
    setSuccess(false);

    // Client-side new === confirm check — UX only; the server action is the gate.
    if (newPassword !== confirmPassword) {
      setConfirmError(PASSWORDS_DONT_MATCH);
      return;
    }

    setSubmitting(true);
    try {
      const result = await changePassword({
        password: newPassword,
        current_password: currentPassword,
      });

      if (result.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess(true);
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
      {success ? <Alert variant="success">Password updated</Alert> : null}

      <Input
        label="Current password"
        type="password"
        name="current_password"
        autoComplete="current-password"
        required
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        error={fieldErrors.current_password}
      />

      <Input
        label="New password"
        type="password"
        name="new_password"
        autoComplete="new-password"
        required
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        error={fieldErrors.password}
        helper="At least 8 characters."
      />

      <Input
        label="Confirm new password"
        type="password"
        name="confirm_password"
        autoComplete="new-password"
        required
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={confirmError ?? undefined}
      />

      <Button type="submit" loading={submitting}>
        Update password
      </Button>
    </form>
  );
}
