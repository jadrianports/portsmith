'use client';

/**
 * Live username-availability indicator (02-UI-SPEC "Username availability
 * indicator", D-01). The signature interactive affordance on the signup form.
 *
 * Behavior:
 *   - Local format gate FIRST: `usernameSchema.safeParse(value)` (length / charset
 *     / reserved). Invalid format never fires a network read.
 *   - Valid format → debounced (350ms) read of `profiles` via the browser anon
 *     client (RLS is the boundary; the username column is public by design — the
 *     public URL — so this is NOT a D-07 enumeration vector).
 *   - Four exclusive states (idle / invalid / checking / available / taken), each
 *     with an icon + caption + `aria-live="polite"` so it is ANNOUNCED, not just
 *     colored (color is never the sole signal).
 *
 * The component reports availability up via `onAvailabilityChange` so the form can
 * (optionally) reflect it; the DB partial-unique index + `handle_new_user` remain
 * the real boundary at submit.
 */
import { Check, CircleAlert, LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { usernameSchema } from '@/lib/validations';

type Status = 'idle' | 'invalid' | 'checking' | 'available' | 'taken';

export interface UsernameAvailabilityProps {
  /** The current username value from the form input. */
  value: string;
  /** Optional callback so the parent can gate submit on a known-taken username. */
  onAvailabilityChange?: (available: boolean | null) => void;
  /**
   * The OWNER's current handle, passed by the change panel (Plan 05) to enable the D-05
   * self-reclaim special-case: a candidate reserved in the owner's OWN history (the
   * reserved row resolves to this `currentUsername`) reads as AVAILABLE. Signup passes
   * nothing, so any reserved hit is treated as taken (the plain D-04 union).
   */
  currentUsername?: string;
}

const DEBOUNCE_MS = 350;

export function UsernameAvailability({
  value,
  onAvailabilityChange,
  currentUsername,
}: UsernameAvailabilityProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');
  const reqId = useRef(0);

  useEffect(() => {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      setStatus('idle');
      setMessage('');
      onAvailabilityChange?.(null);
      return;
    }

    // 1) Local format gate — no network read on invalid input.
    const parsed = usernameSchema.safeParse(trimmed);
    if (!parsed.success) {
      setStatus('invalid');
      setMessage(parsed.error.issues[0]?.message ?? 'That username is not valid.');
      onAvailabilityChange?.(false);
      return;
    }

    // 2) Debounced availability read.
    setStatus('checking');
    setMessage('Checking availability…');
    onAvailabilityChange?.(null);

    const myReq = ++reqId.current;
    const handle = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', trimmed)
          .maybeSingle();

        // Ignore stale responses (a newer keystroke superseded this one).
        if (myReq !== reqId.current) return;

        if (error) {
          // Read failed — don't block the user on a transient error; the DB
          // unique index is the real boundary at submit.
          setStatus('idle');
          setMessage('');
          onAvailabilityChange?.(null);
          return;
        }

        if (data) {
          setStatus('taken');
          setMessage('That username is taken.');
          onAvailabilityChange?.(false);
          return;
        }

        // D-04/D-05: no LIVE collision — check the reserved-handle history through the
        // public_username_redirects view (old_handle + current_username only; NO user_id).
        // A reserved handle is taken UNLESS it is the OWNER's own prior handle (D-05),
        // i.e. the reserved row resolves to the owner's current username.
        const { data: reserved, error: reservedError } = await supabase
          .from('public_username_redirects')
          .select('current_username')
          .eq('old_handle', trimmed)
          .maybeSingle();

        // Ignore stale responses (a newer keystroke superseded this one).
        if (myReq !== reqId.current) return;

        // A reservation read error is non-blocking (the RPC union-uniqueness is the real
        // gate at submit) — fall through to available rather than wedge the user.
        if (!reservedError && reserved) {
          const isOwnReclaim =
            !!currentUsername && reserved.current_username === currentUsername;
          if (!isOwnReclaim) {
            setStatus('taken');
            setMessage('That username is reserved.');
            onAvailabilityChange?.(false);
            return;
          }
        }

        setStatus('available');
        setMessage(`${trimmed} is available.`);
        onAvailabilityChange?.(true);
      } catch {
        if (myReq !== reqId.current) return;
        setStatus('idle');
        setMessage('');
        onAvailabilityChange?.(null);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // onAvailabilityChange is stable in practice; value drives the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (status === 'idle') {
    // Still render the live region (empty) so SR announcements work on transition.
    return <p aria-live="polite" className="sr-only" data-username-status="idle" />;
  }

  const tone =
    status === 'available'
      ? 'text-success'
      : status === 'checking'
        ? 'text-muted-foreground'
        : 'text-destructive';

  return (
    <p
      aria-live="polite"
      data-username-status={status}
      className={`mt-1 flex items-center gap-1.5 text-[13px] leading-tight ${tone}`}
    >
      {status === 'checking' ? (
        <LoaderCircle
          aria-hidden="true"
          className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
        />
      ) : status === 'available' ? (
        // Glyph uses accent (sanctioned use #2); text uses success for AA contrast.
        <Check aria-hidden="true" className="size-3.5 shrink-0 text-accent" />
      ) : status === 'taken' ? (
        <X aria-hidden="true" className="size-3.5 shrink-0" />
      ) : (
        <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
      )}
      <span>{message}</span>
    </p>
  );
}
