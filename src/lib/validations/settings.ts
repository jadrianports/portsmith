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

  // --- public contact email (email-or-empty) ---
  // NOTE: the legacy fixed `*_url` social subset was DROPPED in P25 (migration 025 /
  // SET-05). The active contact/socials write shape is `contactSocialsSettingsSchema`
  // below (socials JSONB array + location + phone).
  email_public: z.email().max(320).or(z.literal('')).optional(),
});

export type Settings = z.infer<typeof settingsSchema>;

// ---------------------------------------------------------------------------
// Contact & Socials write-subset (Phase 24 — SET-01..04)
// ---------------------------------------------------------------------------

/**
 * Curated, closed set of social platforms (D-02 / D-09). No custom links —
 * `website` is the generic globe catch-all. The array order on the column is the
 * display order (D-01/D-03; duplicate platforms are allowed, order disambiguates).
 */
// D-02
export const SOCIAL_PLATFORMS = [
  'github',
  'linkedin',
  'x',
  'instagram',
  'youtube',
  'tiktok',
  'dribbble',
  'behance',
  'facebook',
  'threads',
  'website',
] as const;

/** Per-URL cap — generous (browsers ~2k, well above any real link). */
const SOCIAL_URL_MAX = 2048;
/** Free-form, region-agnostic ("Remote · GMT+1", "Brooklyn, NY"). */
const LOCATION_MAX = 120;
/** International formats + extensions, free-text (D-10 — no format check). */
const PHONE_MAX = 40;
/** Array-length cap (D-02 "≤ ~20 links"). */
const SOCIALS_MAX = 20;

/**
 * One social entry = a curated platform + a REQUIRED http(s) URL. The `url` field
 * reuses the SAME `protocol: /^https?$/` allowlist as `httpUrlOrEmptyOptional`
 * (sections.ts — the CR-01 stored-XSS gate), so a `javascript:`/`data:`/`vbscript:`
 * URL is rejected at the Zod gate before it can reach a rendered `href` sink.
 */
// D-02 / SET-02 (CR-01)
const socialEntrySchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  url: z.url({ protocol: /^https?$/, error: 'Must be an http(s) URL' }).max(SOCIAL_URL_MAX),
});

export const socialsSchema = z.array(socialEntrySchema).max(SOCIALS_MAX);

/**
 * The write-subset the Contact & Socials action re-parses (D-08 scope =
 * email_public + socials + location + phone ONLY — the SEO/theme slices stay
 * unwired). All fields optional; `''` is the explicit set-and-clear idiom (D-10).
 */
// D-01 / D-08
export const contactSocialsSettingsSchema = z.object({
  email_public: z.email().max(320).or(z.literal('')).optional(),
  socials: socialsSchema.optional(),
  location: z.string().max(LOCATION_MAX).or(z.literal('')).optional(),
  phone: z.string().max(PHONE_MAX).or(z.literal('')).optional(),
});

export type ContactSocialsSettings = z.infer<typeof contactSocialsSettingsSchema>;
