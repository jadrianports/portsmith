'use client';

/**
 * Change-email form island (ACCT-02, settings).
 *
 * The chrome client island wired to the reauth-gated `changeEmail` server action
 * (the real gate — the client checks here are UX only). It shows the user's
 * CURRENT email as read-only text, an optional persistent pending-change banner,
 * and a form collecting the NEW email + the current-password reauth proof (D-01).
 * On submit it calls `changeEmail({ email, current_password })`; on `result.ok`
 * it shows the "check BOTH inboxes" success Alert and clears the inputs (the live
 * email does not change until both confirm links are clicked — D-05); on failure
 * it surfaces the action's field/banner errors (the reauth-failure generic `error`
 * lands in the banner — never a silent dead-end).
 *
 * PENDING-STATE BANNER (D-07): `pendingEmail` is `user.new_email` resolved by the
 * parent settings RSC via `getUser()` (the User object — NOT the JWT claims, which
 * omit `new_email`). When non-null, a persistent informational Alert names the
 * pending address and instructs the user to confirm in BOTH the old and new inbox
 * (D-05). `currentEmail` is `claims.email` resolved server-side.
 *
 * Chrome tokens only (Inter, Evergreen/Copper); the Copper accent is
 * focus-ring/link-hover only, so the submit reuses the existing primary Button
 * fill, never an accent fill. There is NO destructive action here, so the
 * destructive token is not used. No bespoke form primitive — Input/Button/Alert
 * from `@/components/ui/*`.
 */
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  changeEmail,
  type ChangeEmailFieldErrors,
} from '@/lib/account/change-email-action';

export interface ChangeEmailFormProps {
  /** The user's CURRENT email (from `claims.email`), shown read-only. */
  currentEmail: string;
  /**
   * The pending NEW email (`user.new_email` via `getUser()`), or `null` when no
   * change is in flight. Drives the persistent pending-change banner (D-07/D-05).
   */
  pendingEmail: string | null;
}

const GENERIC_ERROR = 'Something went wrong. Please try again.';

export function ChangeEmailForm({ currentEmail, pendingEmail }: ChangeEmailFormProps) {
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<ChangeEmailFieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFieldErrors({});
    setBanner(null);
    setSuccess(false);
    setSubmitting(true);

    try {
      const result = await changeEmail({
        email: newEmail,
        current_password: currentPassword,
      });

      if (result.ok) {
        // The live email does NOT change yet — both confirm links must be clicked
        // (D-05). Clear the inputs and show the "check both inboxes" success state.
        setNewEmail('');
        setCurrentPassword('');
        setSuccess(true);
        return;
      }

      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      if (result.error) setBanner(result.error);
    } catch {
      setBanner(GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Current email — read-only; identity is read from claims, never edited here. */}
      <div>
        <p className="mb-1 text-sm font-semibold text-foreground">Current email</p>
        <p className="text-base text-muted-foreground">{currentEmail}</p>
      </div>

      {/* Persistent pending-change banner (D-07/D-05) — only while a change is in flight. */}
      {pendingEmail ? (
        <Alert variant="warning">
          Confirmation sent — email change to <strong>{pendingEmail}</strong> is pending.
          Click the link in BOTH your old and new inbox to finish.
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {banner ? <Alert variant="error">{banner}</Alert> : null}
        {success ? (
          <Alert variant="success">
            Check both your old and new inbox to confirm the change.
          </Alert>
        ) : null}

        <Input
          label="New email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          error={fieldErrors.email}
        />

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

        <Button type="submit" loading={submitting}>
          Change email
        </Button>
      </form>
    </div>
  );
}
