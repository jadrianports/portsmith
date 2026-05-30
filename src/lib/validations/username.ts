/**
 * Shared username validation (FND-04, T-03-04).
 *
 * One source of truth for the username format + reserved-name guard, reused by
 * `profile.ts` (the profile update form) and the future P2 signup form
 * (docs/03-auth-flows.md — signup supplies `username` in `raw_user_meta_data`).
 *
 * Rules (docs/01 CHECK + docs/04):
 *   - 3–30 characters
 *   - `^[a-z][a-z0-9-]*$` — lowercase, must START with a letter, then
 *     lowercase letters / digits / hyphens
 *   - not a reserved name (routes, system words, brand)
 */
import { z } from 'zod';

/** Lowercase, starts with a letter, then [a-z0-9-]. Matches the docs/01 CHECK. */
export const USERNAME_REGEX = /^[a-z][a-z0-9-]*$/;

/**
 * Reserved usernames — names that must never become a public `/[username]` slug
 * because they collide with routes, system concepts, or the brand. Stored
 * lowercase; the format guard already lowercases the input domain.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'dashboard',
  'login',
  'signup',
  'settings',
  'www',
  'app',
  'portsmith',
  'support',
  'help',
  'about',
  'terms',
  'privacy',
  'root',
  'null',
  'undefined',
]);

/** True when `value` is a reserved username (case-insensitive). */
export function isReservedUsername(value: string): boolean {
  return RESERVED_USERNAMES.has(value.toLowerCase());
}

/**
 * The shared username schema: format + length, then a reserved-name refine.
 * Import this anywhere a username is accepted so the gate stays in one place.
 */
export const usernameSchema = z
  .string()
  .min(3, { error: 'Username must be at least 3 characters' })
  .max(30, { error: 'Username must be at most 30 characters' })
  .regex(USERNAME_REGEX, {
    error: 'Username must be lowercase, start with a letter, and contain only a-z, 0-9, or -',
  })
  .refine((v) => !isReservedUsername(v), { error: 'That username is reserved' });

export type Username = z.infer<typeof usernameSchema>;
