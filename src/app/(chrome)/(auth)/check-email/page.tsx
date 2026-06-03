/**
 * Check-email interstitial (02-UI-SPEC "Check email", D-07).
 *
 * Two variants, driven by `?type`:
 *   - post-signup (default): "We've sent a confirmation link to {email}…" plus
 *     the resend affordance (with cooldown). Shown identically whether the email
 *     was new or already registered (enumeration-safe — D-07).
 *   - post-reset (`?type=reset`): "If an account exists for {email}, we've sent a
 *     link to reset your password." No resend (re-request from /forgot-password) —
 *     keeps the reset path enumeration-safe.
 *
 * RSC. `searchParams` is a Promise in Next 16 — awaited. The email is echoed from
 * the query the signup/forgot flow set; it is the user's own input, not a lookup.
 */
import { Link } from '@/components/ui/link';

import { ResendConfirmation } from './resend-confirmation';

export const metadata = {
  title: 'Check your email',
};

interface CheckEmailPageProps {
  searchParams: Promise<{ email?: string; type?: string }>;
}

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const { email, type } = await searchParams;
  const isReset = type === 'reset';
  const safeEmail = email?.trim() || 'your email';

  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
        Check your email
      </h1>

      {isReset ? (
        <p className="mt-4 text-base leading-relaxed text-foreground">
          If an account exists for <span className="font-semibold">{safeEmail}</span>, we&apos;ve
          sent a link to reset your password.
        </p>
      ) : (
        <>
          <p className="mt-4 text-base leading-relaxed text-foreground">
            We&apos;ve sent a confirmation link to{' '}
            <span className="font-semibold">{safeEmail}</span>. Click it to finish setting up your
            account.
          </p>
          {email ? <ResendConfirmation email={email} /> : null}
        </>
      )}

      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        <Link href="/login">Back to login</Link>
      </p>
    </div>
  );
}
