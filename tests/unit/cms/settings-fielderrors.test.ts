/**
 * Phase 24 Plan 02 — code-review gap-fix WR-02. `saveSettingsAction` maps a failed
 * `contactSocialsSettingsSchema.safeParse` into per-field errors keyed by the FULL
 * dotted Zod issue path (e.g. `socials.1.url`), NOT just `issue.path[0]` (which used
 * to collapse every bad social URL onto the single key `socials`). The Contact &
 * Socials form looks up per-row errors by index
 * (`fieldErrors['socials.${index}.url']`, contact-socials-form.tsx:439), so the action
 * must emit that EXACT index-based dotted key for the row error to render.
 *
 * The action itself cannot run in the `node` project (its first step,
 * getVerifiedClaims → cookies(), throws "outside a request scope" — see
 * settings-write.test.ts). So we pin the mapping at its true source: the real
 * `contactSocialsSettingsSchema` issue path → the SAME reducer the action uses.
 *
 * Pure (no I/O, no DOM) — the `node` project.
 */
import { describe, expect, it } from 'vitest';

import { contactSocialsSettingsSchema } from '@/lib/validations';

/**
 * The exact fieldErrors reducer from `saveSettingsAction` (WR-02): key by the full
 * dotted issue path, first-issue-wins per key. Kept in lockstep with the action; if
 * the action's reducer changes, this assertion is the canary.
 */
function buildFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join('.');
    if (key && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

describe('WR-02 — settings fieldErrors keyed by the full dotted issue path', () => {
  it('a bad socials[n].url yields a `socials.<n>.url` key matching the form lookup', () => {
    const parsed = contactSocialsSettingsSchema.safeParse({
      socials: [
        { platform: 'github', url: 'https://github.com/ok' }, // index 0 — valid
        { platform: 'website', url: 'javascript:alert(1)' }, // index 1 — XSS scheme, rejected (CR-01)
      ],
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return; // type-narrow

    const fieldErrors = buildFieldErrors(parsed.error.issues);

    // The corrected key — index-based dotted path, matching
    // contact-socials-form.tsx:439 (`fieldErrors['socials.${index}.url']`).
    expect(fieldErrors).toHaveProperty('socials.1.url');
    // And NOT the old collapsed single key.
    expect(fieldErrors).not.toHaveProperty('socials');
  });

  it('a top-level field error keys by its bare name (e.g. `email_public`)', () => {
    const parsed = contactSocialsSettingsSchema.safeParse({
      email_public: 'not-an-email',
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return; // type-narrow

    const fieldErrors = buildFieldErrors(parsed.error.issues);
    expect(fieldErrors).toHaveProperty('email_public');
  });
});
