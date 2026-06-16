/**
 * settings-allowlist — the PLAIN (non-'use server') home of the mass-assignment
 * defense for the settings write (SET-04, D-12).
 *
 * This module is deliberately NOT a `'use server'` module: Next 16 Turbopack
 * rejects a SYNCHRONOUS value export from a `'use server'` file ("Server Actions
 * must be async functions"). `buildSettingsAllowlist` is a pure synchronous
 * helper, so it lives here — the same precedent as `isRecoverySession` living in
 * its own plain module rather than alongside an async action. `saveSettingsAction`
 * imports it from here.
 */
import { type ContactSocialsSettings } from '@/lib/validations';

/** The exact shape written to `portfolio_settings` — exactly four columns. */
export interface SettingsAllowlist {
  email_public: string;
  socials: NonNullable<ContactSocialsSettings['socials']>;
  location: string | null;
  phone: string | null;
}

/** Empty string / undefined → null (D-10 set-and-clear); any non-empty value passes through. */
function emptyToNull(value: string | undefined): string | null {
  return value && value !== '' ? value : null;
}

/**
 * Build the EXPLICIT `portfolio_settings` UPDATE payload BY HAND (D-12 / SET-04 —
 * the mass-assignment defense). Returns EXACTLY the four sanctioned columns; any
 * extra key on `parsed` (a smuggled portfolio_id / id / role / storage_used_bytes)
 * is dropped — it can never reach `.update()`. Pure (no I/O) so the unit test pins
 * the key set + the empty→null normalization directly.
 */
// D-12 / SET-04
export function buildSettingsAllowlist(parsed: ContactSocialsSettings): SettingsAllowlist {
  return {
    email_public: parsed.email_public ?? '',
    socials: parsed.socials ?? [],
    location: emptyToNull(parsed.location),
    phone: emptyToNull(parsed.phone),
  };
}
