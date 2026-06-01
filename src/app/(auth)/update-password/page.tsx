/**
 * Update-password screen (02-UI-SPEC "Update password", AUTH-04).
 *
 * The recovery landing: the user arrives here from the recovery email via the
 * shared Plan 04 `/auth/confirm?type=recovery` handler, which `verifyOtp`'d the
 * single-use OTP and established a short-lived RECOVERY SESSION before redirecting.
 * This RSC card body renders the H1 + sub-copy (static UI-SPEC copy) and hosts the
 * `UpdatePasswordForm` client island, which calls `updatePassword` — the action
 * re-checks the verified session server-side before `updateUser({ password })`, so
 * the page itself is just the form host.
 */
import { UpdatePasswordForm } from './update-password-form';

export const metadata = {
  title: 'Set a new password',
};

export default function UpdatePasswordPage() {
  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          Set a new password
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Choose a password at least 8 characters long.
        </p>
      </div>

      <UpdatePasswordForm />
    </div>
  );
}
