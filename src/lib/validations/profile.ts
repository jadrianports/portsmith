/**
 * Profile validation (FND-04).
 *
 * Mirrors the `profiles` user-editable columns (docs/01):
 *   - `username`    — via the shared `usernameSchema` (one source of truth)
 *   - `display_name`— 1–100
 *   - `headline`    — max 500 (renamed from `bio`; short SEO/cards tagline)
 *
 * Protected columns (`role`, `email`, `storage_used_bytes`, `locked`, etc.) are
 * NOT in this schema — they are guarded by a DB trigger (docs/02), never written
 * from a profile-edit form.
 */
import { z } from 'zod';

import { usernameSchema } from './username';

export const profileSchema = z.object({
  username: usernameSchema,
  display_name: z
    .string()
    .min(1, { error: 'Display name is required' })
    .max(100, { error: 'Display name must be at most 100 characters' }),
  headline: z.string().max(500, { error: 'Headline must be at most 500 characters' }).optional(),
});

export type Profile = z.infer<typeof profileSchema>;
