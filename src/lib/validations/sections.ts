/**
 * Section-content validation (FND-04 / CMS-08).
 *
 * The schemaless JSONB `sections.content` column has NO structural constraint in
 * Postgres (`sections.type` is `TEXT` with no enumerating CHECK — docs/01). Zod is
 * the SOLE gate: every write must pass `validateSectionContent(type, content)`
 * before it reaches the database (critical rule #1).
 *
 * Soft enum (CMS-08, CONTEXT D-04): `type` is a plain string key into
 * `sectionContentSchemas`. Adding a future profession's section type is a NEW entry
 * in that record / a NEW branch in the union — never a Postgres migration. We do
 * NOT model `type` as a fixed Zod enum that would block adding a branch; the
 * union/record IS the gate.
 *
 * Zod 4 (4.4.3) notes — verified against the installed package:
 *   - TOP-LEVEL string formats only: `z.email()` / `z.url()`. The chained
 *     `z.string().email()` / `.url()` forms are deprecated in v4 and FORBIDDEN by
 *     repo CLAUDE.md ("What NOT to use").
 *   - URL-or-empty pattern: `z.url().or(z.literal('')).optional()` (docs/04).
 *   - Error customization uses the unified `{ error: ... }` param (v3's
 *     `{ message: ... }` / `invalid_type_error` are gone).
 *
 * Alt-text refine (critical rule #4): wherever an image field can be present, a
 * non-empty image REQUIRES a non-empty trimmed `*_alt`. Applied to project items,
 * testimonial items, and the `about` section.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared field helpers
// ---------------------------------------------------------------------------

/** A URL that may also be the empty string, and may be omitted entirely. */
const urlOrEmptyOptional = z.url().or(z.literal('')).optional();

/**
 * Alt-text refine predicate: passes when there is no image, or when the alt text
 * is a non-empty trimmed string. Fails only for "image present, alt missing/blank".
 */
const altTextOk = (image: string | undefined, alt: string | undefined): boolean =>
  !image || (alt?.trim().length ?? 0) > 0;

// ---------------------------------------------------------------------------
// Item schemas (projects / testimonials / experience)
// ---------------------------------------------------------------------------

/**
 * ProjectItem — docs/01 "Section content JSONB shapes".
 * `id` is a client-minted nanoid; `slug` is derived (lowercase) from the title.
 */
export const projectItemSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    title: z.string().min(1).max(100),
    description: z.string().max(1000),
    image: urlOrEmptyOptional,
    image_alt: z.string().optional(),
    tech_stack: z.array(z.string()).max(10),
    live_url: urlOrEmptyOptional,
    repo_url: urlOrEmptyOptional,
  })
  .refine((v) => altTextOk(v.image, v.image_alt), {
    error: 'Alt text is required when an image is present',
    path: ['image_alt'],
  });

/** TestimonialItem — docs/01. `stars` is an integer 1–5. */
export const testimonialItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).max(100),
    quote: z.string().min(1),
    avatar: urlOrEmptyOptional,
    avatar_alt: z.string().optional(),
    stars: z.number().int().min(1).max(5).optional(),
    company: z.string().optional(),
  })
  .refine((v) => altTextOk(v.avatar, v.avatar_alt), {
    error: 'Alt text is required when an avatar image is present',
    path: ['avatar_alt'],
  });

/**
 * ExperienceItem — docs/01. Dates are `YYYY-MM` strings; `end_date` may be empty
 * or the literal `"present"`.
 */
// WR-06: the month component is constrained to 01–12 (`0[1-9]|1[0-2]`) so
// nonsense months like `2020-13` / `2020-00` are rejected — a date field
// rendered on a public portfolio must not accept impossible months.
export const experienceItemSchema = z.object({
  id: z.string().min(1),
  company: z.string().min(1),
  role: z.string().min(1),
  start_date: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'start_date must be YYYY-MM' }),
  end_date: z
    .string()
    .regex(/^(\d{4}-(0[1-9]|1[0-2])|present)?$/, {
      error: "end_date must be YYYY-MM, 'present', or empty",
    })
    .optional(),
  description: z.string().max(1000),
});

// ---------------------------------------------------------------------------
// Per-type section content schemas (the 7 soft-enum branches)
// ---------------------------------------------------------------------------

export const heroContentSchema = z.object({
  heading: z.string().max(100),
  subheading: z.string().optional(),
  cta_text: z.string().optional(),
  cta_url: urlOrEmptyOptional,
  background_image: urlOrEmptyOptional,
});

export const aboutContentSchema = z
  .object({
    bio: z.string().max(2000),
    skills: z.array(z.string()).max(30),
    avatar: urlOrEmptyOptional,
    avatar_alt: z.string().optional(),
  })
  .refine((v) => altTextOk(v.avatar, v.avatar_alt), {
    error: 'Alt text is required when an avatar image is present',
    path: ['avatar_alt'],
  });

export const projectsContentSchema = z.object({
  heading: z.string().max(100),
  items: z.array(projectItemSchema).max(20),
});

export const testimonialsContentSchema = z.object({
  heading: z.string().max(100),
  items: z.array(testimonialItemSchema).max(20),
});

export const experienceContentSchema = z.object({
  heading: z.string().max(100),
  items: z.array(experienceItemSchema).max(20),
});

export const contactContentSchema = z.object({
  heading: z.string().max(100),
  subheading: z.string().optional(),
});

export const blogPreviewContentSchema = z.object({
  heading: z.string().max(100),
  post_count: z.number().int(),
});

// ---------------------------------------------------------------------------
// Soft-enum registry + the gate function
// ---------------------------------------------------------------------------

/**
 * The soft-enum registry (CMS-08): a plain record from the TEXT `type` to its
 * content schema. This is the single structural gate. Adding a new profession's
 * section type means adding a key here — no Postgres migration, no enum change.
 */
export const sectionContentSchemas = {
  hero: heroContentSchema,
  about: aboutContentSchema,
  projects: projectsContentSchema,
  testimonials: testimonialsContentSchema,
  experience: experienceContentSchema,
  contact: contactContentSchema,
  blog_preview: blogPreviewContentSchema,
} as const;

/** The currently-known section types (derived from the registry keys). */
export type SectionType = keyof typeof sectionContentSchemas;

/**
 * Validate a section's content against the schema registered for its `type`.
 *
 * - Returns the parsed, typed content for a known type with valid content.
 * - Throws (Zod error) for a known type with invalid content.
 * - Throws an explicit error for an UNREGISTERED type — there is no schema for it,
 *   so it cannot pass the gate. (Registering a new type is a one-line change here.)
 */
export function validateSectionContent(type: string, content: unknown): unknown {
  const schema = sectionContentSchemas[type as SectionType];
  if (!schema) {
    throw new Error(`No validation schema registered for section type: "${type}"`);
  }
  return schema.parse(content);
}

// ---------------------------------------------------------------------------
// Inferred TypeScript types (z.infer)
// ---------------------------------------------------------------------------

export type ProjectItem = z.infer<typeof projectItemSchema>;
export type TestimonialItem = z.infer<typeof testimonialItemSchema>;
export type ExperienceItem = z.infer<typeof experienceItemSchema>;

export type HeroContent = z.infer<typeof heroContentSchema>;
export type AboutContent = z.infer<typeof aboutContentSchema>;
export type ProjectsContent = z.infer<typeof projectsContentSchema>;
export type TestimonialsContent = z.infer<typeof testimonialsContentSchema>;
export type ExperienceContent = z.infer<typeof experienceContentSchema>;
export type ContactContent = z.infer<typeof contactContentSchema>;
export type BlogPreviewContent = z.infer<typeof blogPreviewContentSchema>;
