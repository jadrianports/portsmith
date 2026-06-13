'use client';

/**
 * Danger Zone island (ACCT-03, D-12/D-14) — the isolated, permanent account-delete
 * card at the bottom of /dashboard/settings.
 *
 * The conventional isolated destructive-action region (D-14): its own bordered card,
 * visually separated, using the chrome DESTRUCTIVE token for the heading/border accent
 * — NEVER the Copper accent (the chrome accent is focus-ring / link-hover / "available"
 * only, never a destructive fill). The delete Button reuses the established destructive
 * pattern (primary Button + `bg-destructive` className override, inheriting
 * `text-brand-foreground` — the same pattern as item-card.tsx / message-row.tsx), so
 * no new primitive is introduced.
 *
 * DOUBLE GATE (D-12): the delete button is `disabled` until the typed username EXACTLY
 * equals the `username` prop AND the current-password field is non-empty. The server
 * route (`POST /api/account/delete`) is the REAL gate — it re-asserts the type-exact
 * username against the verified profile username and runs the D-01 reauth — but the
 * client gate makes the destructive action deliberate (the user must retype their own
 * handle) and avoids a pointless round-trip.
 *
 * SUCCESS = FULL-PAGE NAVIGATION (not a router push). The route clears the
 * @supabase/ssr session cookies server-side (signOut → cookie-clearing Set-Cookie); a
 * client `router.push` would keep the now-stale in-memory router/auth state, so on a
 * 200 `{ ok: true }` we do `window.location.assign('/?deleted=1')` — a hard navigation
 * that re-reads the cleared cookies and lands on the "account deleted" surface.
 *
 * Chrome tokens + the destructive token ONLY (Inter, Evergreen/Copper chrome). Generic
 * error copy on any non-OK response (the route returns generic typed JSON — never leak
 * which gate failed); a loading state on the button during the request.
 */
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface DangerZoneProps {
  /** The user's exact username — the handle the user must retype to confirm (D-12). */
  username: string;
}

const GENERIC_ERROR = 'Something went wrong. Please try again.';

export function DangerZone({ username }: DangerZoneProps) {
  const [typedUsername, setTypedUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // D-12 — the button is enabled ONLY when the typed username EXACTLY matches the
  // user's handle AND a password has been entered. (The server re-asserts both.)
  const canDelete = typedUsername === username && currentPassword.length > 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !canDelete) return;

    setBanner(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: typedUsername,
          current_password: currentPassword,
        }),
      });

      if (res.ok) {
        // The session cookies were cleared server-side — a FULL-PAGE navigation
        // (not router.push) re-reads the cleared cookies and lands on the deleted
        // surface. We do not return to a now-defunct authenticated view.
        window.location.assign('/?deleted=1');
        return;
      }

      // Any non-OK response → one generic error (the route never leaks which gate
      // failed: password vs. username vs. session).
      setBanner(GENERIC_ERROR);
    } catch {
      setBanner(GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="danger-zone-heading"
      className="rounded-lg border-2 border-destructive bg-surface p-6"
    >
      <h2 id="danger-zone-heading" className="text-lg font-semibold text-destructive">
        Danger Zone
      </h2>

      <div className="mt-4">
        <h3 className="text-base font-semibold text-foreground">Delete account</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This permanently deletes your account, portfolio, and all uploaded media.
          This cannot be undone.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4">
        {banner ? <Alert variant="error">{banner}</Alert> : null}

        <Input
          label={
            <>
              Type your username <span className="font-normal text-muted-foreground">({username})</span> to confirm
            </>
          }
          type="text"
          name="username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={typedUsername}
          onChange={(e) => setTypedUsername(e.target.value)}
        />

        <Input
          label="Current password"
          type="password"
          name="current_password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />

        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          disabled={!canDelete}
          className="bg-destructive hover:bg-destructive"
        >
          Delete my account
        </Button>
      </form>
    </section>
  );
}
