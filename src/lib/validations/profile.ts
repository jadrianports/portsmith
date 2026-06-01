/**
 * Profile validation (FND-04).
 *
 * Mirrors the `profiles` user-editable columns (docs/01):
 *   - `username`    — via the shared `usernameSchema` (one source of truth)
 *   - `display_name`— 1–100
 *   - `headline`    — max 500 (renamed from `bio`; short SEO/cards tagline)
 *   - `resume_url`  — http(s) URL or empty/omitted (WR-04 — scheme-gated)
 *   - `avatar_url`  — http(s) URL or empty/omitted (WR-04 — scheme-gated)
 *
 * URL SCHEME GATE (WR-04, 03-REVIEW): `resume_url` flows toward a rendered `href`
 * (the hero "Download résumé" button) and `avatar_url` toward an `<Image src>`.
 * Both were previously written by the founder seed via the service-role client with
 * NO Zod gate at all, so a dangerous-scheme URL (`javascript:`/`data:`) could reach
 * the DB and a rendered attribute. They now reuse the SAME http(s) allowlist as
 * every other URL field (`httpUrlOrEmptyOptional`, CR-01). The seed validates the
 * profile columns it writes against this schema before the service-role update.
 *
 * Protected columns (`role`, `email`, `storage_used_bytes`, `locked`, etc.) are
 * NOT in this schema — they are guarded by a DB trigger (docs/02), never written
 * from a profile-edit form.
 */
import { z } from 'zod';

import { httpUrlOrEmptyOptional } from './sections';
import { usernameSchema } from './username';

export const profileSchema = z.object({
  username: usernameSchema,
  display_name: z
    .string()
    .min(1, { error: 'Display name is required' })
    .max(100, { error: 'Display name must be at most 100 characters' }),
  headline: z.string().max(500, { error: 'Headline must be at most 500 characters' }).optional(),
  // WR-04: http(s)-only (rejects javascript:/data:/vbscript:) — these feed an href
  // and an <Image src> respectively. Optional/empty-allowed so a profile with no
  // résumé or avatar still validates.
  resume_url: httpUrlOrEmptyOptional,
  avatar_url: httpUrlOrEmptyOptional,
});

export type Profile = z.infer<typeof profileSchema>;
