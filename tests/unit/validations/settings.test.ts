/**
 * Wave 0 (24-01) — SET-02 · D-01 / D-02 / D-08 · CR-01: the Contact & Socials
 * write-subset Zod gate.
 *
 * This is layer 1 of the stored-XSS defense for the socials write path: the
 * `socialEntrySchema.url` field reuses the SAME `z.url({ protocol: /^https?$/ })`
 * allowlist as `httpUrlOrEmptyOptional` (sections.ts), so a `javascript:` / `data:` /
 * `vbscript:` URL is rejected at the gate before it can ever reach a rendered `href`
 * sink (T-24-01).
 *
 * The schemas under test (`socialsSchema`, `contactSocialsSettingsSchema`,
 * `SOCIAL_PLATFORMS`) are authored in settings.ts and barrel-exported from
 * `@/lib/validations`. RED today: the bindings are `undefined` so every parse throws.
 */
import { describe, expect, it } from 'vitest';

import {
  SOCIAL_PLATFORMS,
  contactSocialsSettingsSchema,
  socialsSchema,
} from '@/lib/validations';

describe('SET-02 / CR-01 — socials url is http(s)-only (stored-XSS gate)', () => {
  it('rejects a javascript: url with an issue path including "url"', () => {
    const result = socialsSchema.safeParse([{ platform: 'github', url: 'javascript:alert(1)' }]);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths.some((p) => p.includes('url'))).toBe(true);
    }
  });

  it('rejects a data: url', () => {
    const result = socialsSchema.safeParse([
      { platform: 'github', url: 'data:text/html,<script>alert(1)</script>' },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects a vbscript: url', () => {
    const result = socialsSchema.safeParse([{ platform: 'github', url: 'vbscript:msgbox(1)' }]);
    expect(result.success).toBe(false);
  });

  it('accepts a valid https url', () => {
    const result = socialsSchema.safeParse([
      { platform: 'linkedin', url: 'https://linkedin.com/in/x' },
    ]);
    expect(result.success).toBe(true);
  });
});

describe('SET-02 / D-02 / D-09 — curated closed platform enum', () => {
  it('exposes the 11-member curated set', () => {
    expect(SOCIAL_PLATFORMS).toHaveLength(11);
    expect(SOCIAL_PLATFORMS).toContain('x');
    expect(SOCIAL_PLATFORMS).toContain('website');
  });

  it('rejects an off-list platform (mastodon)', () => {
    const result = socialsSchema.safeParse([{ platform: 'mastodon', url: 'https://example.com' }]);
    expect(result.success).toBe(false);
  });

  it('accepts every curated platform', () => {
    const all = SOCIAL_PLATFORMS.map((platform) => ({ platform, url: 'https://example.com' }));
    const result = socialsSchema.safeParse(all);
    expect(result.success).toBe(true);
  });
});

describe('SET-02 — socials caps', () => {
  it('rejects an array longer than the max (21 entries)', () => {
    const many = Array.from({ length: 21 }, () => ({
      platform: 'github' as const,
      url: 'https://github.com/x',
    }));
    const result = socialsSchema.safeParse(many);
    expect(result.success).toBe(false);
  });

  it('accepts a 20-entry array (the boundary)', () => {
    const many = Array.from({ length: 20 }, () => ({
      platform: 'github' as const,
      url: 'https://github.com/x',
    }));
    const result = socialsSchema.safeParse(many);
    expect(result.success).toBe(true);
  });

  it('rejects a url longer than the per-url cap', () => {
    const longUrl = `https://example.com/${'a'.repeat(2100)}`;
    const result = socialsSchema.safeParse([{ platform: 'website', url: longUrl }]);
    expect(result.success).toBe(false);
  });
});

describe('SET-01 / D-10 — contactSocialsSettingsSchema (email/location/phone)', () => {
  it('is reachable from the @/lib/validations barrel and parses a full payload', () => {
    const result = contactSocialsSettingsSchema.safeParse({
      email_public: 'me@example.com',
      socials: [{ platform: 'github', url: 'https://github.com/me' }],
      location: 'Brooklyn, NY',
      phone: '+1 555 0100',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty-string email_public (clear)', () => {
    const result = contactSocialsSettingsSchema.safeParse({ email_public: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed email', () => {
    const result = contactSocialsSettingsSchema.safeParse({ email_public: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects an email_public over 320 chars', () => {
    const huge = `${'a'.repeat(320)}@example.com`;
    const result = contactSocialsSettingsSchema.safeParse({ email_public: huge });
    expect(result.success).toBe(false);
  });

  it('accepts location:"" and phone:"" (set-and-clear)', () => {
    const result = contactSocialsSettingsSchema.safeParse({ location: '', phone: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a location over its cap', () => {
    const result = contactSocialsSettingsSchema.safeParse({ location: 'x'.repeat(121) });
    expect(result.success).toBe(false);
  });

  it('rejects a phone over its cap', () => {
    const result = contactSocialsSettingsSchema.safeParse({ phone: 'x'.repeat(41) });
    expect(result.success).toBe(false);
  });
});
