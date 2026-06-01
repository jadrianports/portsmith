// CMS-06 — turned GREEN by 04-03 (server-boundary Zod gate for section saves).
//
// Wave-0 RED scaffold (04-01). This file is INTENTIONALLY failing: it imports the
// not-yet-built `saveSectionAction` server action so the import fails to resolve
// until 04-03 ships it. RED is the contract (Nyquist sampling, 04-VALIDATION.md).
// Do NOT implement the action here — 04-03 turns this GREEN.
//
// Behavior under test (the server-boundary re-parse gate, T-V5 input-validation):
//   - a known type (hero) with VALID content passes the gate;
//   - a known type (hero) with INVALID content is REJECTED at the SERVER boundary
//     (not just the client) — the action returns { ok: false } with field errors;
//   - an UNREGISTERED type is rejected (no schema registered → cannot pass).
//
// The gate the action wraps is the existing `validateSectionContent` (sections.ts);
// these assertions describe the ACTION's contract over it (re-parse + result shape).
import { describe, expect, it } from 'vitest';

// @ts-expect-error — RED: 04-03 creates this server action; module does not exist yet.
import { saveSectionAction } from '@/lib/cms/save-section-action';

// hero content: heading max 100; subheading optional (sections.ts heroContentSchema).
const validHeroContent = { heading: 'Hi, I build things', subheading: 'Engineer' };
// INVALID: heading exceeds the 100-char max → server gate must reject.
const invalidHeroContent = { heading: 'x'.repeat(101) };

describe('CMS-06 — saveSectionAction server-boundary Zod gate', () => {
  it('accepts a known type (hero) with valid content', async () => {
    const result = await saveSectionAction({
      sectionId: '00000000-0000-0000-0000-000000000001',
      type: 'hero',
      content: validHeroContent,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a known type (hero) with INVALID content at the server boundary', async () => {
    const result = await saveSectionAction({
      sectionId: '00000000-0000-0000-0000-000000000001',
      type: 'hero',
      content: invalidHeroContent,
    });
    expect(result.ok).toBe(false);
    // Server re-parse → field-level errors (mirrors the signup-action loop).
    if (!result.ok) {
      expect(result.fieldErrors ?? result.error).toBeTruthy();
    }
  });

  it('rejects an UNREGISTERED section type (no schema in the soft enum)', async () => {
    const result = await saveSectionAction({
      sectionId: '00000000-0000-0000-0000-000000000001',
      type: 'not-a-real-type',
      content: { anything: true },
    });
    expect(result.ok).toBe(false);
  });
});
