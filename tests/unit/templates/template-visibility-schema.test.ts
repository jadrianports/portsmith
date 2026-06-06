// GATE-03 / 12-03 Task 1 — `templateVisibilitySchema` behavior (the visibility
// soft-enum Zod gate co-located with `templateSlugSchema` in registry.ts).
//
// Zod is the SOURCE OF TRUTH for `templates.visibility` (the column has NO Postgres
// CHECK — the CMS-08 soft-enum posture, D-P12-01). This enum is what the 12-05 admin
// `setTemplateVisibility` action re-parses through, and what the 12-03 switch gate
// compares against ('restricted'). It imports zod, so — like `templateSlugSchema` —
// it stays SERVER-side (the client picker imports display copy from `template-meta.ts`,
// never this file — D-25).
import { describe, expect, it } from 'vitest';

import { templateVisibilitySchema } from '@/components/templates/registry';

describe('templateVisibilitySchema — the visibility soft-enum gate', () => {
  it("accepts 'public'", () => {
    expect(templateVisibilitySchema.safeParse('public').success).toBe(true);
  });

  it("accepts 'restricted'", () => {
    expect(templateVisibilitySchema.safeParse('restricted').success).toBe(true);
  });

  it('rejects any other string', () => {
    expect(templateVisibilitySchema.safeParse('anything-else').success).toBe(false);
    expect(templateVisibilitySchema.safeParse('').success).toBe(false);
    expect(templateVisibilitySchema.safeParse('Public').success).toBe(false);
  });
});
