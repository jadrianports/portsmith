import { describe, expect, it } from 'vitest';

/**
 * Harness smoke test. Exists so `vitest run tests/unit` exits 0 before any real
 * unit tests are written (Vitest fails a run that matches zero test files).
 * Safe to delete once the first real Zod schema test (FND-04 / CMS-08) lands.
 */
describe('vitest unit harness', () => {
  it('runs', () => {
    expect(true).toBe(true);
  });
});
