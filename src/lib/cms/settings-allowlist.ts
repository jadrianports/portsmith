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
import { type ContactSocialsSettings, type SeoSettings } from '@/lib/validations';

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

// ---------------------------------------------------------------------------
// SEO / page-identity allowlist (Phase 29 — META-01..04, D-02)
// ---------------------------------------------------------------------------

/**
 * The exact shape an SEO save writes to `portfolio_settings` — exactly the four SEO
 * columns. DISJOINT from `SettingsAllowlist` (no shared keys): so `saveSeoSettings`
 * touches NONE of the contact columns (email_public / socials / location / phone) and
 * vice-versa (D-02 — the no-clobber contract, the #1 functional risk).
 */
export interface SeoAllowlist {
  page_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  favicon_url: string | null;
}

/**
 * Build the EXPLICIT SEO `portfolio_settings` UPDATE payload BY HAND (D-02 / the
 * mass-assignment defense, mirroring `buildSettingsAllowlist`). Returns EXACTLY the
 * four SEO columns — a smuggled key (role / username / storage_used_bytes / any
 * contact column) is dropped and can never reach `.update()`. Each empty/undefined
 * value → null (D-06 set-and-clear revert). Pure (no I/O), DISJOINT from the contact
 * allowlist so the partial save never clobbers the columns it does not own.
 */
// D-02 / META-01..04
export function buildSeoAllowlist(parsed: SeoSettings): SeoAllowlist {
  return {
    page_title: emptyToNull(parsed.page_title),
    meta_description: emptyToNull(parsed.meta_description),
    og_image_url: emptyToNull(parsed.og_image_url),
    favicon_url: emptyToNull(parsed.favicon_url),
  };
}
