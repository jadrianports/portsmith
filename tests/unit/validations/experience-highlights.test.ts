/**
 * TDD: optional `highlights[]` on experience items (edgerunner faithful-clone).
 *
 * `experienceItemSchema` must accept an optional `highlights` array of 1–8
 * non-empty strings (max 200 chars each), and REJECT a non-array value or more
 * than 8 entries.
 *
 * Uses `experienceItemSchema.safeParse` (consistent with the codebase pattern in
 * `tests/unit/validations.test.ts`) and `validateSectionContent` for the full
 * content-level gate check. Imported from the `@/lib/validations` barrel.
 */
import { describe, it, expect } from 'vitest';
import { experienceItemSchema, validateSectionContent } from '@/lib/validations/sections';

// ---------------------------------------------------------------------------
// Base fixture — fields match the real experienceItemSchema exactly:
//   id (min 1), company (min 1), role (min 1), start_date (YYYY-MM regex),
//   end_date (YYYY-MM | 'present' | '' | omitted), description (max 1000).
// No adjustments needed — the task's field names match the schema.
// ---------------------------------------------------------------------------
const baseItem = {
  id: 'e1',
  company: 'Acme',
  role: 'Engineer',
  start_date: '2023-01',
  end_date: 'present',
  description: 'Built things',
};

const base = {
  heading: 'Experience',
  items: [baseItem],
};

describe('experience.highlights', () => {
  it('accepts content with no highlights (back-compat)', () => {
    expect(experienceItemSchema.safeParse(baseItem).success).toBe(true);
    // Also verify via the full section gate (validateSectionContent throws on failure)
    expect(() => validateSectionContent('experience', base)).not.toThrow();
  });

  it('accepts an item with a highlights array', () => {
    const item = { ...baseItem, highlights: ['Shipped X', 'Led Y'] };
    expect(experienceItemSchema.safeParse(item).success).toBe(true);
  });

  it('rejects more than 8 highlights', () => {
    const item = { ...baseItem, highlights: Array(9).fill('x') };
    expect(experienceItemSchema.safeParse(item).success).toBe(false);
  });

  it('rejects a non-array highlights value', () => {
    const item = { ...baseItem, highlights: 'nope' };
    expect(experienceItemSchema.safeParse(item).success).toBe(false);
  });
});
