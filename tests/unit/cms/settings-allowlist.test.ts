/**
 * Phase 24 Plan 02 — the mass-assignment defense for the settings write (SET-04,
 * D-12). `saveSettingsAction` builds the `portfolio_settings` UPDATE payload by
 * hand via `buildSettingsAllowlist`, NEVER by spreading the parsed/input object.
 * This pins that the helper returns EXACTLY the four sanctioned columns
 * { email_public, socials, location, phone } — so an attacker key smuggled into
 * the parsed object (portfolio_id, id, role, storage_used_bytes, …) can never
 * reach `.update()`.
 *
 * Also pins the D-10 set-and-clear normalization (SET-03): location/phone empty
 * string → null on save; a non-empty value passes through. And the optional
 * defaults: socials → [] when undefined, email_public → '' when undefined.
 *
 * Pure (no I/O, no DOM) — the `node` project.
 */
import { describe, expect, it } from 'vitest';

import { buildSettingsAllowlist } from '@/lib/cms/save-settings-action';

const EXACT_KEYS = ['email_public', 'socials', 'location', 'phone'] as const;

describe('SET-04 — buildSettingsAllowlist (mass-assignment defense)', () => {
  it('returns EXACTLY { email_public, socials, location, phone } — drops attacker keys', () => {
    const built = buildSettingsAllowlist({
      email_public: 'me@example.com',
      socials: [{ platform: 'github', url: 'https://github.com/me' }],
      location: 'Remote',
      phone: '+1 555',
      // Attacker-smuggled keys that must NEVER reach the .update() payload:
      portfolio_id: 'pf-attacker',
      id: 'row-attacker',
      role: 'admin',
      storage_used_bytes: 0,
      username: 'someoneelse',
    } as never);

    expect(Object.keys(built).sort()).toEqual([...EXACT_KEYS].sort());
    expect(built).not.toHaveProperty('portfolio_id');
    expect(built).not.toHaveProperty('id');
    expect(built).not.toHaveProperty('role');
    expect(built).not.toHaveProperty('storage_used_bytes');
    expect(built).not.toHaveProperty('username');
  });

  it('passes through the four sanctioned values when present', () => {
    const built = buildSettingsAllowlist({
      email_public: 'me@example.com',
      socials: [{ platform: 'x', url: 'https://x.com/me' }],
      location: 'Brooklyn, NY',
      phone: '+44 20 1234',
    });
    expect(built.email_public).toBe('me@example.com');
    expect(built.socials).toEqual([{ platform: 'x', url: 'https://x.com/me' }]);
    expect(built.location).toBe('Brooklyn, NY');
    expect(built.phone).toBe('+44 20 1234');
  });

  it('normalizes empty-string location/phone to null (D-10 set-and-clear, SET-03)', () => {
    const built = buildSettingsAllowlist({
      email_public: '',
      socials: [],
      location: '',
      phone: '',
    });
    expect(built.location).toBeNull();
    expect(built.phone).toBeNull();
  });

  it('defaults socials → [] and email_public → "" when undefined', () => {
    const built = buildSettingsAllowlist({});
    expect(built.socials).toEqual([]);
    expect(built.email_public).toBe('');
    // location/phone undefined also normalize to null (nothing to write).
    expect(built.location).toBeNull();
    expect(built.phone).toBeNull();
  });
});
