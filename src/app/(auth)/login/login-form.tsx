'use client';

/**
 * Login form island (02-UI-SPEC "Login", AUTH-03 / D-07).
 *
 * The client island inside the RSC login card. It collects email + password and
 * submits to the server action `loginAction` (the real gate — client validation
 * is UX only). On success it navigates to the dashboard, or to a validated
 * internal `redirectedFrom` (the middleware sets that when it bounces an
 * unauthenticated request off a protected route).
 *
 * Enumeration-safe messaging (D-07) renders straight from the action's outcome:
 *   - invalid credentials → the single generic banner ("That email or password
 *     isn't right…") — never reveals which field.
 *   - the ONE exception → an UNCONFIRMED user gets a warning prompt + a "Resend
 *     confirmation email" link that calls `supabase.auth.resend({type:'signup'})`
 *     via the browser client (the resend outcome is treated generically too).
 *
 * The form keeps a single primary CTA ("Log in"); "Forgot password?" sits inline
 * by the password label as a link to `/forgot-password` (built in Plan 05).
 */
import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from '@/components/ui/link';
import { loginAction, type LoginFieldErrors } from '@/lib/auth/login-action';
import { createClient } from '@/lib/supabase/client';

/** Only same-origin absolute paths are honored as a post-login destination. */
function safeInternalPath(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return '/dashboard';
  }
  return raw;
}

/** Inline resend-confirmation link shown only on the unconfirmed-user exception. */
function ResendConfirmationLink({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  async function handleResend() {
    if (state !== 'idle') return;
    setState('sending');
    try {
      const supabase = createClient();
      await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/confirm`,
        },
      });
    } catch {
      // Generic — never reveal existence.
    } finally {
      setState('sent');
    }
  }

  if (state === 'sending') {
    return (
      <span className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
        <LoaderCircle
          aria-hidden="true"
          className="size-3.5 animate-spin motion-reduce:animate-none"
        />
        <span>Sending…</span>
      </span>
    );
  }

  if (state === 'sent') {
    return (
      <span className="mt-2 block text-[13px] text-muted-foreground">Sent. Check your inbox.</span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleResend}
      className="mt-2 rounded-sm text-left text-[13px] font-semibold text-foreground underline decoration-1 underline-offset-[3px] outline-none transition-colors hover:text-accent hover:decoration-2 focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      Resend confirmation email
    </button>
  );
}

export function LoginForm({ redirectedFrom }: { redirectedFrom?: string }) {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFieldErrors({});
    setBanner(null);
    setUnconfirmedEmail(null);
    setSubmitting(true);

    try {
      const result = await loginAction({ email, password });

      if (result.ok) {
        router.push(safeInternalPath(redirectedFrom));
        router.refresh();
        return;
      }

      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      // The D-07 exception: an unconfirmed user gets a warning prompt + resend.
      if (result.unconfirmed && result.email) {
        setUnconfirmedEmail(result.email);
      }
      if (result.error) setBanner(result.error);
    } catch {
      setBanner('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {/* The unconfirmed-user prompt is the ONE sanctioned enumeration signal (D-07). */}
      {unconfirmedEmail ? (
        <Alert variant="warning">
          {banner}
          <ResendConfirmationLink email={unconfirmedEmail} />
        </Alert>
      ) : banner ? (
        <Alert variant="error">{banner}</Alert>
      ) : null}

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

      <div>
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />
        <p className="mt-2 text-right text-[13px]">
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
      </div>

      <Button type="submit" loading={submitting}>
        Log in
      </Button>
    </form>
  );
}
