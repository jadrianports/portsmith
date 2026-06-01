'use client';

/**
 * Forgot-password form island (02-UI-SPEC "Forgot password", AUTH-04 / D-07).
 *
 * The client island inside the RSC forgot-password card. It collects an email and
 * submits to the server action `requestReset` (the real gate — client Zod here is
 * UX only). The action ALWAYS returns the same generic outcome (D-07), so on a
 * well-formed email the form routes to the reset variant of `/check-email`, which
 * renders "If an account exists for {email}, we've sent a link to reset your
 * password." There is NO resend on the reset variant — the user re-requests from
 * here, which keeps the path enumeration-safe.
 *
 * The only failure surfaced is a malformed email (a format field error, not an
 * existence signal). Everything else lands on the generic interstitial.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requestReset, type RequestResetFieldErrors } from '@/lib/auth/reset-actions';

export function ForgotPasswordForm() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RequestResetFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFieldErrors({});
    setSubmitting(true);

    try {
      const result = await requestReset({ email });

      if (result.ok) {
        // Always-generic interstitial (reset variant — no resend, D-07).
        router.push(`/check-email?type=reset&email=${encodeURIComponent(email)}`);
        return;
      }

      // The only failure is a malformed email (format, not existence).
      setFieldErrors(result.fieldErrors);
    } catch {
      // A thrown error must not reveal existence — route to the same generic
      // interstitial the success path uses.
      router.push(`/check-email?type=reset&email=${encodeURIComponent(email)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
      />

      <Button type="submit" loading={submitting}>
        Send reset link
      </Button>
    </form>
  );
}
