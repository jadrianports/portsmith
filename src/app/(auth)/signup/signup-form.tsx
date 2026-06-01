'use client';

/**
 * Signup form island (02-UI-SPEC "Signup", AUTH-01 / SAFE-01 front door).
 *
 * The client island inside the RSC signup card. It collects email + password +
 * username (with the live availability adornment) + the required ToS checkbox +
 * the Turnstile widget, then submits to the server action `signupAction` (the
 * real gate — client Zod here is UX only). On success it routes to
 * `/check-email?email=…` with the SAME generic outcome whether or not the email
 * already existed (D-07). Field/banner errors render through the `ui/*`
 * primitives. The Turnstile widget sits AFTER the ToS checkbox and BEFORE submit,
 * and submit is disabled until a token is set (UI-SPEC).
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { TurnstileWidget } from '@/components/auth/turnstile-widget';
import { UsernameAvailability } from '@/components/auth/username-availability';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Link } from '@/components/ui/link';
import { signupAction, type SignupFieldErrors } from '@/lib/auth/signup-action';

export function SignupForm() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);

  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFieldErrors({});
    setBanner(null);
    setSubmitting(true);

    try {
      const result = await signupAction({
        email,
        password,
        username,
        turnstile_token: token ?? '',
        tos_accepted: tosAccepted,
      });

      if (result.ok) {
        router.push(`/check-email?email=${encodeURIComponent(result.email)}`);
        return;
      }

      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      if (result.error) setBanner(result.error);

      // Reset the single-use Turnstile token after any failed submit (Pitfall 5).
      setToken(null);
      setResetSignal((n) => n + 1);
    } catch {
      setBanner('Something went wrong. Please try again.');
      setToken(null);
      setResetSignal((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {banner ? <Alert variant="error">{banner}</Alert> : null}

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

      <Input
        label="Password"
        type="password"
        name="password"
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        helper="At least 8 characters."
      />

      <div>
        <Input
          label="Username"
          type="text"
          name="username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={fieldErrors.username}
        />
        {!fieldErrors.username ? <UsernameAvailability value={username} /> : null}
      </div>

      <Checkbox
        id="tos_accepted"
        name="tos_accepted"
        checked={tosAccepted}
        onChange={(e) => setTosAccepted(e.target.checked)}
        error={fieldErrors.tos_accepted}
        label={
          <span>
            I agree to the <Link href="/legal">Terms &amp; Privacy</Link>.
          </span>
        }
      />

      <TurnstileWidget onToken={setToken} resetSignal={resetSignal} />

      <Button type="submit" loading={submitting} disabled={!token}>
        Create account
      </Button>
    </form>
  );
}
