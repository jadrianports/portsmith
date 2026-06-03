/**
 * Signup screen (02-UI-SPEC "Signup", AUTH-01 / SAFE-01).
 *
 * RSC card body inside the `(auth)` shell. The heading + sub-copy are static
 * (UI-SPEC copywriting contract); the interactive form is the `SignupForm`
 * client island. The card surface/radius/shadow/hairline are token-driven
 * (no inline hex). A cross-link to login sits below the form.
 */
import { Link } from '@/components/ui/link';

import { SignupForm } from './signup-form';

export const metadata = {
  title: 'Create your account',
};

export default function SignupPage() {
  return (
    <div className="rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
          Create your account
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Publish a polished portfolio in about 15 minutes.
        </p>
      </div>

      <SignupForm />

      <p className="mt-6 text-center text-[13px] text-muted-foreground">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
