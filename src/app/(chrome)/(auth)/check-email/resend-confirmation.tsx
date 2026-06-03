'use client';

/**
 * Resend-confirmation affordance (02-UI-SPEC "Check email" interstitial, D-07).
 *
 * Shown only on the POST-SIGNUP variant of /check-email (the reset variant has no
 * resend — re-requesting from /forgot-password keeps it enumeration-safe). States
 * mirror the UI-SPEC: idle → sending (spinner + "Sending…") → sent ("Sent. Check
 * your inbox.") → 60s cooldown ("Resend in {n}s", tabular numerals), then idle.
 *
 * Calls `supabase.auth.resend({ type: 'signup', email, options:{ emailRedirectTo }})`
 * via the browser client. The outcome is treated generically — we never surface
 * whether the email exists.
 */
import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

type State = 'idle' | 'sending' | 'sent';

const COOLDOWN_SECONDS = 60;

export function ResendConfirmation({ email }: { email: string }) {
  const [state, setState] = useState<State>('idle');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function handleResend() {
    if (state === 'sending' || cooldown > 0) return;
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
      // Generic — never reveal existence; the cooldown still applies.
    } finally {
      setState('sent');
      setCooldown(COOLDOWN_SECONDS);
    }
  }

  if (state === 'sending') {
    return (
      <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
        <LoaderCircle
          aria-hidden="true"
          className="size-3.5 animate-spin motion-reduce:animate-none"
        />
        <span>Sending…</span>
      </p>
    );
  }

  if (cooldown > 0) {
    return (
      <p className="mt-4 text-center text-[13px] text-muted-foreground">
        Sent. Check your inbox. Resend in{' '}
        <span className="tabular-nums">{cooldown}</span>s
      </p>
    );
  }

  return (
    <p className="mt-4 text-center text-[13px] text-muted-foreground">
      Didn&apos;t get it?{' '}
      <button
        type="button"
        onClick={handleResend}
        className="rounded-sm font-semibold text-foreground underline decoration-1 underline-offset-[3px] outline-none transition-colors hover:text-accent hover:decoration-2 focus-visible:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Resend confirmation email
      </button>
    </p>
  );
}
