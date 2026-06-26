/**
 * LogoutButton — the user-facing sign-out control (the logout that was missing).
 *
 * A plain `<form action={logoutAction}>` + submit button: the server action signs out
 * and redirects to /login, so this needs NO client JS and works identically rendered
 * from a client island (the editor header) or an RSC (the Settings page). Two visual
 * variants share the one action:
 *   - 'header'   → the chrome control-pill idiom (matches the Messages/Settings buttons).
 *   - 'settings' → a ghost Button inside the account-settings card.
 *
 * Chrome tokens only (Inter, Evergreen/Copper); the copper accent is hover/focus only.
 */
import { LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { logoutAction } from '@/lib/auth/logout-action';

export function LogoutButton({ variant = 'settings' }: { variant?: 'header' | 'settings' }) {
  if (variant === 'header') {
    return (
      <form action={logoutAction}>
        <button
          type="submit"
          className={
            'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-4 ' +
            'text-sm font-semibold text-foreground outline-none transition-colors ' +
            'hover:border-border-strong hover:text-accent ' +
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
            'motion-reduce:transition-none'
          }
        >
          <LogOut aria-hidden="true" className="size-3.5" />
          <span>Log out</span>
        </button>
      </form>
    );
  }

  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" className="w-auto">
        <LogOut aria-hidden="true" className="size-4" />
        Sign out
      </Button>
    </form>
  );
}
