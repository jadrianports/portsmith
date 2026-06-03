/**
 * Forgot-password screen (02-UI-SPEC "Forgot password", AUTH-04 / D-07).
 *
 * RSC card body inside the `(auth)` shell. The heading + sub-copy are static
 * (UI-SPEC copywriting contract); the interactive form is the `ForgotPasswordForm`
 * client island. On submit it routes to the reset variant of `/check-email`, which
 * renders the always-generic "If an account exists for {email}, we've sent a link"
 * interstitial — identical whether or not the account exists (D-07). A cross-link
 * back to login sits below the form.
 */
import { Link } from '@/components/ui/link';

import { ForgotPasswordForm } from './forgot-password-form';

export const metadata = {
  title: 'Reset your password',
};

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          Reset your password
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Enter your email and we&apos;ll send a link to reset it.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        Remembered it? <Link href="/login">Back to login</Link>
      </p>
    </div>
  );
}
