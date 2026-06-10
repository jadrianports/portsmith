/**
 * Validation barrel — the single import surface for every platform Zod schema
 * (FND-04 / CMS-08). Consumers import from `@/lib/validations`, never from the
 * individual files, so the gate has one entry point.
 *
 *   import { contactFormSchema, validateSectionContent } from '@/lib/validations';
 */

// Section content: the soft-enum registry + the gate function + item schemas.
export * from './sections';

// Profile + the shared username guard (reused by profile and the P2 signup form).
export * from './username';
export * from './profile';

// Portfolio settings (theme / SEO / social).
export * from './settings';

// Contact form (POST /api/contact request body).
export * from './contact';

// Blog post (P2 feature, schema authored now per D-04).
export * from './blog';

// Markdown post write gate (13.2 — body_md source model; postContentSchema, D-03/D-04).
export * from './posts';

// Auth (signup/login/reset/update-password request bodies — server-boundary gate).
export * from './auth';

// Page-view beacon (POST /api/page-view request body — server gate, D-04; no Turnstile).
export * from './page-view';
