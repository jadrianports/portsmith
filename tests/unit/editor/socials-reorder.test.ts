/**
 * 24-03 (Wave 3, SET-02 / D-14 / D-15) — the Contact & Socials form's two PURE
 * helpers, exercised render-free (the `node` unit project, the reorder-by-ids /
 * move-within-group precedent): no jsdom, no @testing-library — just the array math
 * + the buildInput key-strip.
 *
 *   1. `reorderSocialRows(rows, from, to)` — the in-form `arrayMove` over LOCAL state
 *      (SET-02). It mutates ONLY the local socials array; the persisted order is the
 *      array order on explicit Save (D-14 — NO per-drag server write). Moving index
 *      0 → 2 yields the expected sequence and preserves every row object identity.
 *
 *   2. `buildSettingsInput(...)` — the form's payload builder. It STRIPS the
 *      client-only React/dnd `key` so only `{ platform, url }` persists (D-15), and
 *      maps an empty-string email_public/location/phone to `undefined` so the action
 *      normalizes them to '' / null (mirrors profile-form's undefined-on-empty).
 *
 * RED until 24-03 Task 1 EXPORTS both helpers from `contact-socials-form.tsx` (the
 * import below fails to resolve — the impl-driven RED precedent, NOT a syntax error).
 */
import { describe, expect, it } from 'vitest';

import {
  buildSettingsInput,
  reorderSocialRows,
  type SocialRow,
} from '@/components/editor/contact-socials-form';

/** A minimal SocialRow factory — `key` is the client-only synthetic id. */
function row(key: string, platform: string, url: string): SocialRow {
  return { key, platform, url };
}

describe('24-03 SET-02 / D-14 — reorderSocialRows (local-state arrayMove)', () => {
  it('moves index 0 → 2, yielding the expected sequence (the reorder helper)', () => {
    const rows = [
      row('k1', 'github', 'https://gh'),
      row('k2', 'linkedin', 'https://li'),
      row('k3', 'website', 'https://site'),
    ];
    const result = reorderSocialRows(rows, 0, 2);

    expect(result.map((r) => r.key)).toEqual(['k2', 'k3', 'k1']);
    // Same row object identities, just reordered (no reconstruction).
    expect(result[0]).toBe(rows[1]);
    expect(result[1]).toBe(rows[2]);
    expect(result[2]).toBe(rows[0]);
  });

  it('moves index 2 → 0 (chevron-up fallback over local state)', () => {
    const rows = [
      row('k1', 'github', 'https://gh'),
      row('k2', 'linkedin', 'https://li'),
      row('k3', 'website', 'https://site'),
    ];
    const result = reorderSocialRows(rows, 2, 0);

    expect(result.map((r) => r.key)).toEqual(['k3', 'k1', 'k2']);
  });

  it('is a no-op-safe identity when from === to', () => {
    const rows = [row('k1', 'github', 'https://gh'), row('k2', 'x', 'https://x')];
    const result = reorderSocialRows(rows, 1, 1);
    expect(result.map((r) => r.key)).toEqual(['k1', 'k2']);
  });
});

describe('24-03 D-15 — buildSettingsInput strips the client-only key', () => {
  it('emits socials entries that are EXACTLY { platform, url } (no key)', () => {
    const rows = [
      row('k1', 'github', 'https://gh'),
      row('k2', 'website', 'https://site'),
    ];
    const input = buildSettingsInput({
      emailPublic: 'me@example.com',
      location: 'Remote · GMT+1',
      phone: '+1 555',
      rows,
      username: 'founder',
    });

    expect(input.socials).toEqual([
      { platform: 'github', url: 'https://gh' },
      { platform: 'website', url: 'https://site' },
    ]);
    // No `key` survives onto any persisted entry.
    for (const entry of input.socials ?? []) {
      expect('key' in entry).toBe(false);
    }
  });

  it('maps empty-string email_public / location / phone to undefined (undefined-on-empty)', () => {
    const input = buildSettingsInput({
      emailPublic: '',
      location: '',
      phone: '',
      rows: [],
      username: 'founder',
    });

    expect(input.email_public).toBeUndefined();
    expect(input.location).toBeUndefined();
    expect(input.phone).toBeUndefined();
    expect(input.socials).toEqual([]);
    // username threads through unchanged (it builds the revalidate path, never a column).
    expect(input.username).toBe('founder');
  });

  it('passes non-empty contact fields through verbatim', () => {
    const input = buildSettingsInput({
      emailPublic: 'hi@x.com',
      location: 'Brooklyn, NY',
      phone: '+44 20',
      rows: [],
      username: undefined,
    });

    expect(input.email_public).toBe('hi@x.com');
    expect(input.location).toBe('Brooklyn, NY');
    expect(input.phone).toBe('+44 20');
  });
});
