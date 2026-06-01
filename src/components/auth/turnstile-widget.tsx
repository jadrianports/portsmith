'use client';

/**
 * Turnstile widget (02-UI-SPEC "Turnstile widget", AUTH-01 / D-05 client half).
 *
 * Wraps `@marsidev/react-turnstile`. The widget produces a single-use, 300s token
 * that the signup form sends to the server action, where it is VERIFIED (the
 * client widget is NOT the gate — D-05). This component:
 *   - reports the solved token up via `onToken` (and clears it on error/expiry),
 *   - resets itself after a failed submit so the user gets a fresh token
 *     (Pitfall 5 — token reuse/expiry), exposed through the `resetSignal` prop,
 *   - follows system light/dark via `theme="auto"`,
 *   - surfaces the expiry/error caption from the UI-SPEC copy.
 *
 * Placement (enforced by the form): AFTER the ToS checkbox, BEFORE submit; the
 * submit button stays disabled until a token is set.
 */
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useEffect, useRef, useState } from 'react';

import { FieldError } from '@/components/ui/field-error';

const EXPIRED_MESSAGE = 'Verification expired — please complete it again.';

export interface TurnstileWidgetProps {
  /** Called with the token when solved, and with `null` on error/expiry. */
  onToken: (token: string | null) => void;
  /**
   * Bump this number to force a widget reset (e.g. after a failed submit) so a
   * stale single-use token is replaced — Pitfall 5.
   */
  resetSignal?: number;
}

export function TurnstileWidget({ onToken, resetSignal = 0 }: TurnstileWidgetProps) {
  const ref = useRef<TurnstileInstance | undefined>(undefined);
  const [expired, setExpired] = useState(false);

  // Reset the widget whenever the parent bumps `resetSignal` (post-failed-submit).
  useEffect(() => {
    if (resetSignal > 0) {
      ref.current?.reset();
      setExpired(false);
      onToken(null);
    }
    // onToken is stable in practice; resetSignal drives the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!siteKey) {
    // Misconfiguration — never silently allow a missing challenge. Surface it.
    return (
      <FieldError id="turnstile-config-error">
        Verification is unavailable right now. Please try again later.
      </FieldError>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        options={{ theme: 'auto', size: 'flexible' }}
        onSuccess={(token) => {
          setExpired(false);
          onToken(token);
        }}
        onExpire={() => {
          setExpired(true);
          onToken(null);
        }}
        onError={() => {
          setExpired(true);
          onToken(null);
        }}
        className="w-full"
      />
      {expired ? <FieldError id="turnstile-expired">{EXPIRED_MESSAGE}</FieldError> : null}
    </div>
  );
}
