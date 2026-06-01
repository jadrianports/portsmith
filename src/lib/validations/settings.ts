/**
 * Portfolio settings validation (FND-04).
 *
 * Mirrors the user-editable `portfolio_settings` columns (docs/01):
 *   - theme: `theme_mode` (light|dark enum), `visitor_theme_toggle` boolean,
 *     `color_preset` / `font_preset` (preset keys, max 30 — docs/04)
 *   - SEO: `page_title`, `meta_description`, `og_image_url`, `favicon_url`
 *   - social: github/linkedin/twitter/dribbble/website as URL-or-empty,
 *     `email_public` as email-or-empty (this is the INTENDED-public address;
 *     the private `profiles.email` is what must never leak — do not confuse them)
 *
 * All fields are optional so the schema validates partial setting updates; the DB
 * supplies defaults (docs/01).
 */
import { z } from 'zod';

import { httpUrlOrEmptyOptional } from './sections';

/**
 * A scheme-restricted (http/https only) URL that may also be the empty string, and
 * may be omitted entirely. Reuses the single CR-01 stored-XSS gate defined in
 * `./sections` — plain `z.url()` accepts `javascript:`/`data:`/`vbscript:` in the
 * installed Zod 4.4.3, and these settings URLs (social links → footer `href`,
 * `og_image_url`/`favicon_url` → metadata) feed rendered sinks just like the
 * section content fields do.
 */
const urlOrEmptyOptional = httpUrlOrEmptyOptional;

/** SEO meta-field length caps (sane limits — search engines truncate well below). */
const PAGE_TITLE_MAX = 200;
const META_DESCRIPTION_MAX = 500;
const PRESET_MAX = 30;

export const settingsSchema = z.object({
  // --- theme ---
  theme_mode: z.enum(['light', 'dark']).optional(),
  visitor_theme_toggle: z.boolean().optional(),
  color_preset: z.string().max(PRESET_MAX).optional(),
  font_preset: z.string().max(PRESET_MAX).optional(),

  // --- SEO ---
  page_title: z.string().max(PAGE_TITLE_MAX).optional(),
  meta_description: z.string().max(META_DESCRIPTION_MAX).optional(),
  og_image_url: urlOrEmptyOptional,
  favicon_url: urlOrEmptyOptional,

  // --- social links (URL-or-empty) ---
  github_url: urlOrEmptyOptional,
  linkedin_url: urlOrEmptyOptional,
  twitter_url: urlOrEmptyOptional,
  dribbble_url: urlOrEmptyOptional,
  website_url: urlOrEmptyOptional,

  // --- public contact email (email-or-empty) ---
  email_public: z.email().max(320).or(z.literal('')).optional(),
});

export type Settings = z.infer<typeof settingsSchema>;
