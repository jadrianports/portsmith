/**
 * Unit coverage for the server-side disposable-email guard (SAFE-01 / D-03).
 *
 * The guard wraps `mailchecker` (bundled static blocklist, ~55k+ domains) and is
 * the server-side gate that runs in the signup action BEFORE `auth.signUp` — a
 * client-only check is bypassable (Pitfall 4). `MailChecker.isValid` takes the
 * FULL email (not a domain) and returns true for a deliverable, non-disposable,
 * well-formed address.
 *
 * We assert the reject/allow decision directly (no network — the list is bundled):
 *   - a disposable domain (mailinator.com) is rejected
 *   - a permanent address (gmail.com) is allowed
 */
import { describe, expect, it } from 'vitest';

// `import 'server-only'` is a build-time guard that throws outside an RSC graph;
// stub it so the module imports in the node unit env.
import { vi } from 'vitest';
vi.mock('server-only', () => ({}));

import { isDisposableEmail } from '@/lib/auth/disposable-email';

describe('isDisposableEmail — server-side blocklist (SAFE-01)', () => {
  it('rejects a disposable/temp domain (mailinator.com)', () => {
    expect(isDisposableEmail('someone@mailinator.com')).toBe(true);
  });

  it('rejects another well-known disposable domain (guerrillamail.com)', () => {
    expect(isDisposableEmail('throwaway@guerrillamail.com')).toBe(true);
  });

  it('allows a permanent address (gmail.com)', () => {
    expect(isDisposableEmail('real.person@gmail.com')).toBe(false);
  });

  it('allows another permanent provider (outlook.com)', () => {
    expect(isDisposableEmail('real.person@outlook.com')).toBe(false);
  });
});
