/**
 * Wave 0 — brand placement consistency gate (BRAND-03, D-09).
 *
 * BRAND-03 promises the brand mark is "applied consistently" across all FOUR chrome
 * surface families — landing (header + footer), auth shell, dashboard (EditorShell),
 * and admin (AdminNav) — each importing the SHARED `@/components/brand/*` component,
 * never re-implementing the mark. `tsc` alone can't catch a render placed in the
 * wrong JSX branch or an import silently dropped from one surface; this test reads
 * each surface module's SOURCE from disk and asserts the shared import is present.
 *
 * Driven from the array of 5 surface paths so a future surface that loses (or never
 * gains) the brand import fails loudly here. Pure Node — no React render needed
 * (editor-shell/admin-nav are `'use client'` and heavy to render in unit context;
 * the import-presence assertion is the right altitude — 32-VALIDATION BRAND-03 row).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Project-root-relative (vitest runs with cwd = repo root).
const SURFACES = [
  'src/components/landing/landing-header.tsx',
  'src/components/landing/footer.tsx',
  'src/app/(chrome)/(auth)/layout.tsx',
  'src/components/editor/editor-shell.tsx',
  'src/components/admin/admin-nav.tsx',
] as const;

// Matches `import { Lockup } from '@/components/brand/lockup'` (and any other
// brand component / quote style) — the shared-mark import every surface must carry.
const BRAND_IMPORT = /from\s+['"]@\/components\/brand\//;

describe('brand placement consistency (BRAND-03)', () => {
  it.each(SURFACES)(
    '%s imports a shared @/components/brand/* component',
    async (relPath) => {
      const source = await readFile(join(process.cwd(), relPath), 'utf8');
      expect(source).toMatch(BRAND_IMPORT);
    },
  );

  it('covers all five chrome surface families', () => {
    // Guard against the array being trimmed — BRAND-03 spans exactly these 5.
    expect(SURFACES).toHaveLength(5);
  });
});
