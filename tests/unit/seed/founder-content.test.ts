/**
 * META-05 / D-08 — the founder seed `page_title` must be NULL so the render-time
 * fallback (`page_title ?? "{displayName} — Portfolio"`, D-07) derives it. Phase 29
 * strips the stale hardcoded `page_title` ('Kai Nakamura — Senior Full-Stack
 * Developer') from the founder seed; new accounts already leave it NULL via
 * `initialize_portfolio()`, so this is purely a seed-data correction.
 *
 * RED until Plan 04 nulls `FOUNDER.settings.page_title` in
 * `scripts/seed/founder-content.ts` (the gitignored real founder fixture — the same
 * object the seed script imports). The companion `display_name === 'Kai Nakamura'`
 * assertion is GREEN now and guards against over-deletion (D-08 keeps the persona).
 */
import { describe, expect, it } from 'vitest';

// The gitignored real founder fixture (local-stack seed source). Plan 04 edits THIS
// file's `settings.page_title` → null.
import { FOUNDER } from '../../../scripts/seed/founder-content';

describe('META-05 / D-08 — founder seed SEO defaults', () => {
  it('settings.page_title is null (derives via the D-07 render-time fallback)', () => {
    expect(FOUNDER.settings.page_title).toBeNull();
  });

  it('profile.display_name stays "Kai Nakamura" (D-08 keeps the persona)', () => {
    expect(FOUNDER.profile.display_name).toBe('Kai Nakamura');
  });
});
