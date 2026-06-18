/**
 * Login screen (02-UI-SPEC "Login", AUTH-03 / D-07) — the middleware redirect target.
 *
 * The Phase 1 middleware redirects unauthenticated requests for protected routes
 * to `/login?redirectedFrom=…`; a failed `/auth/confirm` redirects to
 * `/login?error=auth`. This RSC card body renders the H1 + sub-copy (static
 * UI-SPEC copy), surfaces the `?error=auth` banner, and hosts the `LoginForm`
 * client island (the real submit → `loginAction`). The `redirectedFrom` query is
 * passed to the form so a successful login returns the user to where they were
 * headed (validated to an internal path inside the form).
 *
 * `searchParams` is a Promise in Next 16 — awaited. Both query values are echoed
 * UI context, never a data lookup, so there is no enumeration surface here.
 */
import { GoogleSignInSection } from '@/components/auth/google-button';
import { Alert } from '@/components/ui/alert';
import { Link } from '@/components/ui/link';

import { LoginForm } from './login-form';

export const metadata = {
  title: 'Welcome back',
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string; redirectedFrom?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, redirectedFrom } = await searchParams;
  const showConfirmError = error === 'auth';

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          Welcome back
        </h1>
      </div>

      {showConfirmError ? (
        <div className="mb-4">
          <Alert variant="error">
            That link is invalid or has expired. Please log in or request a new link.
          </Alert>
        </div>
      ) : null}

      <LoginForm redirectedFrom={redirectedFrom} />

      <GoogleSignInSection />

      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        Don&apos;t have an account? <Link href="/signup">Create your account</Link>
      </p>
    </div>
  );
}
