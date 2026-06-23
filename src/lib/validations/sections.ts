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
 *   - URL-or-empty pattern: `z.url({ protocol: /^https?$/ }).or(z.literal('')).optional()`.
 *   - Error customization uses the unified `{ error: ... }` param (v3's
 *     `{ message: ... }` / `invalid_type_error` are gone).
 *
 * SCHEME ALLOWLIST — STORED-XSS GATE (CR-01, 03-REVIEW). Plain `z.url()` validates
 * via the WHATWG `URL` constructor and, in the installed Zod 4.4.3, ACCEPTS
 * dangerous schemes — `javascript:`, `data:`, `vbscript:` (verified empirically:
 * `z.url().safeParse('javascript:alert(1)').success === true`). Those strings flow
 * straight into rendered `href`/`src` attributes in the (frozen) template renderers
 * and into the SAME gate the Phase-4 multi-tenant CMS will use, so an attacker-
 * authored `javascript:` URL would become a clickable stored-XSS link on a public
 * page. Zod 4's `z.url({ protocol })` constrains the scheme AT THE GATE: the regex
 * is matched against the normalized lowercase `protocol` WITHOUT the trailing colon
 * (`https`, not `https:`), so `/^https?$/` admits only `http`/`https` (case-folded —
 * `HTTPS://…` passes) and rejects every dangerous scheme. This is defense-in-depth
 * layer 1; the `safeHref` render guard (`@/lib/safe-url`) is layer 2.
 *
 * Alt-text refine (critical rule #4): wherever an image field can be present, a
 * non-empty image REQUIRES a non-empty trimmed `*_alt`. Applied to project items,
 * testimonial items, and the `about` section.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared field helpers
// ---------------------------------------------------------------------------

/**
 * A scheme-restricted (http/https only) URL that may also be the empty string, and
 * may be omitted entirely. The `protocol` allowlist is the CR-01 stored-XSS gate —
 * see the header note. Exported so the profile schema (WR-04) reuses the SAME gate.
 */
export const httpUrlOrEmptyOptional = z
  .url({ protocol: /^https?$/, error: 'Must be an http(s) URL' })
  .or(z.literal(''))
  .optional();

/** @deprecated alias kept for the internal call sites below; identical to {@link httpUrlOrEmptyOptional}. */
const urlOrEmptyOptional = httpUrlOrEmptyOptional;

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
    // Category tag pills (edgerunner faithful-clone — rendered ABOVE tech pills on each
    // card). Additive/optional — no Postgres migration (content is schemaless JSONB, CMS-08).
    // Max 6 tags per item, each trimmed non-empty string ≤40 chars.
    tags: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
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
  // Optional bullet-point highlights for rich templates (edgerunner faithful-clone).
  // max(8) caps the list to a readable length; each entry is trimmed, non-empty, ≤200 chars.
  // Additive/optional — no Postgres migration (content is schemaless JSONB, CMS-08).
  highlights: z.array(z.string().trim().min(1).max(200)).max(8).optional(),
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
  // WR-01 (03-REVIEW): the "Download résumé" button reads `content.resume_url`, so
  // the field MUST live on the schema or Zod `.parse()` strips it (unknown keys are
  // dropped) and the button can never render (the D-14 dead-button bug). Additive,
  // OPTIONAL, http(s)-validated — the SAME additive idiom the contact section uses
  // for `email_public` (no Postgres migration; CMS-08). The seed surfaces
  // `profile.resume_url` into the hero content so the field survives the gate.
  resume_url: urlOrEmptyOptional,
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
  // OPTIONAL public contact email surfaced INTO the contact content so the section
  // can render a `mailto:` fallback under the FROZEN `{ section }` SectionProps
  // contract (03-04) — the section never receives `data.settings`, so the public
  // email is carried here instead (the SAME additive idiom the hero uses for
  // `resume_url`). This is purely additive on the schemaless JSONB content — NO
  // Postgres migration (CMS-08 "new field, no migration"). The seed copies
  // `settings.email_public` → `contact.email_public`. Profession-agnostic + optional:
  // a contact section with no public email simply renders no mailto. Accepts a valid
  // email, the empty string, or omission (the empty string ⇒ no mailto rendered).
  email_public: z.email().or(z.literal('')).optional(),
});

/**
 * BlogPreviewPostItem — one teaser card. `accent` drives the card's border+title color.
 * All fields except `id` and `slug` are optional so incomplete drafts pass the gate.
 * Additive/optional on schemaless JSONB — NO Postgres migration (CMS-08).
 */
export const blogPreviewPostItemSchema = z.object({
  id: z.string(),
  slug: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(150),
  excerpt: z.string().trim().max(500).optional(),
  date: z.string().trim().max(40).optional(),
  reading_time: z.string().trim().max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
  accent: z.enum(['pink', 'cyan', 'purple']).optional(),
});

export const blogPreviewContentSchema = z.object({
  heading: z.string().max(100),
  post_count: z.number().int(),
  // Optional data-driven items array (edgerunner-v2 TRANSMISSIONS section).
  // Additive — no migration; older records without `items` pass the gate unchanged.
  items: z.array(blogPreviewPostItemSchema).max(12).optional(),
});

/**
 * Skills — the first NET-NEW section type added after the Phase-1 baseline, and
 * the first real exercise of CMS-08's "new type, no Postgres migration" promise
 * (CONTEXT D-08). Registering `skills` below is a one-line additive change; the
 * `validateSectionContent` gate, the `SectionType` union, and the `@/lib/validations`
 * barrel all pick it up automatically.
 *
 * Profession-agnostic by construction (CONTEXT D-27): `icon`, `tier`, and `level` are
 * ALL optional, so a marketer's "Core Competencies" group is as valid as a developer's
 * "Tech Stack". `icon` is a free-form simple-icons slug string (e.g. 'react'); leaving
 * it a bare string keeps the schema profession-neutral.
 *
 * TWO RENDERINGS, NO CONTRADICTION (reconciles the Phase-3 vs Phase-13 "D-09" labels —
 * RESEARCH §7 / Pitfall 5):
 *   - `tier` (core/proficient/learning) is the TASTEFUL-LABEL rendering used by the
 *     standard-lane templates (minimal/editorial) — those templates render text tier
 *     pills and NEVER numeric / percentage gauges (the Phase-3 CONTEXT D-09 decision).
 *   - `level` (optional, 0–100 int) is consumed ONLY by rich templates (edgerunner) for
 *     its signature animated bars (the Phase-13 CONTEXT D-09 decision). minimal/editorial
 *     IGNORE `level` entirely — its presence in the data never forces a gauge anywhere.
 * Both fields are optional and template-independent, so the same content round-trips
 * losslessly across any template switch ("clamp the data, free the look").
 */
export const skillItemSchema = z.object({
  name: z.string().min(1).max(60),
  icon: z.string().optional(), // simple-icons slug, e.g. 'react' — optional ⇒ profession-agnostic
  tier: z.enum(['core', 'proficient', 'learning']).optional(), // tasteful labels for minimal/editorial (Phase-3 D-09)
  level: z.number().int().min(0).max(100).optional(), // 0–100 proficiency for edgerunner's animated bars (Phase-13 D-09); ignored by minimal/editorial
});

export const skillGroupSchema = z.object({
  label: z.string().min(1).max(60), // "Core Competencies" / "Tech Stack" / "Currently Learning"
  items: z.array(skillItemSchema).max(40),
});

export const skillsContentSchema = z.object({
  heading: z.string().max(100),
  groups: z.array(skillGroupSchema).max(6),
});

// ---------------------------------------------------------------------------
// Marketer-vertical soft-enum types (11-04 Step C1, CMS-08 — NO migration)
// ---------------------------------------------------------------------------
//
// The five NET-NEW soft-enum types added to support the `aurora` marketer template
// (the second real exercise of CMS-08's "new type, no Postgres migration" promise,
// after `skills`). `sections.type` is TEXT with no enumerating CHECK and `content` is
// schemaless JSONB — so each new type is purely a new key in `sectionContentSchemas`
// below + its schema here; the `validateSectionContent` gate, the `SectionType` union,
// and the `@/lib/validations` barrel all pick them up automatically.
//
// PROFESSION-AGNOSTIC by construction: the field shapes were modeled from the marketer
// export's section components but kept generic — `education` fits a developer's degrees
// as well as a marketer's; `metrics` is any "by the numbers" stat block; `services` is
// any offering list; `moodboard` is any captioned image gallery + optional palette;
// `certifications` is any credential list. Most-optional-where-reasonable, item-based
// (arrays of objects) mirroring `skills`/`projects`/`experience`. Every URL field uses
// the shared `httpUrlOrEmptyOptional` stored-XSS gate (CR-01); every image field carries
// the `altTextOk` refine.

/**
 * EducationItem — a degree / programme entry. `year` is a free-form label
 * ('2016 - 2020', '2022', 'In progress') NOT a strict YYYY-MM (educations are commonly
 * stated as ranges/years on a portfolio, so the experience date regex is too strict here).
 * `achievements` is an optional bullet list.
 */
export const educationItemSchema = z.object({
  id: z.string().min(1),
  degree: z.string().min(1).max(150),
  school: z.string().min(1).max(150),
  year: z.string().max(60).optional(),
  achievements: z.array(z.string().max(200)).max(10).optional(),
});

export const educationContentSchema = z.object({
  heading: z.string().max(100),
  items: z.array(educationItemSchema).max(20),
});

/**
 * MetricItem — one headline stat. `value` is a free-form display string ('5+', '10M+',
 * '98%') so it carries its own units/sign; `label` describes it; `icon` is an optional
 * free-form simple-icons / lucide slug (kept a bare string ⇒ profession-neutral).
 */
export const metricItemSchema = z.object({
  id: z.string().min(1),
  value: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  icon: z.string().max(60).optional(),
});

export const metricsContentSchema = z.object({
  heading: z.string().max(100),
  subheading: z.string().max(300).optional(),
  items: z.array(metricItemSchema).max(12),
});

/**
 * ServiceItem — one offering. `deliverables` is an optional bullet list of what the
 * service includes; `icon` is an optional free-form slug.
 */
export const serviceItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  icon: z.string().max(60).optional(),
  deliverables: z.array(z.string().max(200)).max(10).optional(),
});

export const servicesContentSchema = z.object({
  heading: z.string().max(100),
  subheading: z.string().max(300).optional(),
  items: z.array(serviceItemSchema).max(20),
});

/**
 * MoodboardImage — one captioned gallery image. `image` is http(s)-gated (CR-01) and,
 * when present, REQUIRES a non-empty `image_alt` (the `altTextOk` refine — critical
 * rule #4, same idiom as project/testimonial/about images). `caption` is an optional
 * display label rendered over the image.
 */
export const moodboardImageSchema = z
  .object({
    id: z.string().min(1),
    image: urlOrEmptyOptional,
    image_alt: z.string().optional(),
    caption: z.string().max(120).optional(),
  })
  .refine((v) => altTextOk(v.image, v.image_alt), {
    error: 'Alt text is required when an image is present',
    path: ['image_alt'],
  });

/**
 * PaletteSwatch — an optional brand-colour swatch. `color` is a hex (`#RGB` / `#RRGGBB`,
 * case-insensitive) — a constrained literal, NOT a URL/free-string — so it can be set as
 * an inline `background-color` style WITHOUT being a CSS-injection sink. `name` is an
 * optional label ('Rose Pink').
 */
export const paletteSwatchSchema = z.object({
  color: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, { error: 'color must be a #RGB or #RRGGBB hex' }),
  name: z.string().max(60).optional(),
});

export const moodboardContentSchema = z.object({
  heading: z.string().max(100),
  subheading: z.string().max(300).optional(),
  items: z.array(moodboardImageSchema).max(24),
  palette: z.array(paletteSwatchSchema).max(12).optional(),
});

/**
 * CertificationItem — one credential. `url` (an optional verification / badge link) is
 * http(s)-gated (CR-01) since it feeds an `href`. `issuer`/`year`/`description` are
 * optional display fields.
 */
export const certificationItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(150),
  issuer: z.string().max(120).optional(),
  year: z.string().max(60).optional(),
  description: z.string().max(300).optional(),
  url: urlOrEmptyOptional,
});

export const certificationsContentSchema = z.object({
  heading: z.string().max(100),
  items: z.array(certificationItemSchema).max(20),
});

// ---------------------------------------------------------------------------
// Creative-vertical soft-enum types (35-01, CMS-08 — NO migration)
// ---------------------------------------------------------------------------
//
// The two NET-NEW creative section types for the visual-creative vertical (v2.8
// "Show the Work"): `gallery` (a clean photo wall) and `case_study` (one project
// told as a story). Same CMS-08 soft-enum idiom as `skills` and the five marketer
// types — each is purely a new schema here + a key in `sectionContentSchemas`; the
// `validateSectionContent` gate, the `SectionType` union, and the `@/lib/validations`
// barrel pick them up automatically. `sections.type` is TEXT (no CHECK); `content`
// is schemaless JSONB. Zero Postgres migration.
//
// DIVERGENCE from the moodboard/marketer image items: gallery & case_study images
// are STORED objects emitted by the Phase-34 GalleryUploader, never optional draft
// slots — so each image carries a REQUIRED http(s) `url` (the CR-01 stored-XSS gate,
// NOT the empty-optional variant), REQUIRED positive-int `width`/`height` (the
// uploader always emits them; CLS-safe rendering in Phase-36), and a REQUIRED
// non-empty `alt` (alt rule #4 — a plain `.trim().min(1)`, not the conditional
// `altTextOk` refine, since the image is never absent). NO caption (D-02 — keeps
// gallery distinct from moodboard).

/**
 * GalleryImage — one stored gallery image (D-02/D-05). `url` is http(s)-gated
 * (CR-01 stored-XSS); `width`/`height` are REQUIRED positive ints (the Phase-34
 * GalleryUploader emit always carries them, and the Phase-36 renderer needs them to
 * reserve space CLS-free); `alt` is REQUIRED non-empty (alt rule #4 — the image IS
 * the work, never an empty draft slot). NO caption (D-02).
 */
export const galleryImageSchema = z.object({
  id: z.string().min(1),
  url: z.url({ protocol: /^https?$/, error: 'Must be an http(s) URL' }),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().trim().min(1, { error: 'Alt text is required' }),
});

export const galleryContentSchema = z.object({
  heading: z.string().max(100).optional(),
  items: z.array(galleryImageSchema).max(40), // GAL-01 quota/DoS cap (T-35-DOS)
});

/**
 * CaseStudyImage — identical shape to `galleryImageSchema` (REQUIRED http(s) url +
 * positive-int dims + non-empty alt). These are the NESTED images under each
 * case-study item (`content.items[].images[]`).
 */
export const caseStudyImageSchema = z.object({
  id: z.string().min(1),
  url: z.url({ protocol: /^https?$/, error: 'Must be an http(s) URL' }),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().trim().min(1, { error: 'Alt text is required' }),
});

/**
 * CaseStudyItem — one project told as a story (D-05). `title` is the LONE required
 * field; `role`/`client`/`year` are optional meta (`year` free-form like
 * `educationItemSchema.year`); `challenge`/`process`/`outcome` are the three optional
 * narrative blocks — each a SINGLE text block (D-05, `process` is NOT a step array).
 * `images` is the NESTED per-item array, capped at 5 (GAL-02 / D-06).
 */
export const caseStudyItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(150), // the ONE required field (D-05)
  role: z.string().max(120).optional(),
  client: z.string().max(120).optional(),
  year: z.string().max(60).optional(), // free-form label, like educationItemSchema.year
  challenge: z.string().max(2000).optional(),
  process: z.string().max(2000).optional(), // a SINGLE text block, NOT a step array (D-05)
  outcome: z.string().max(2000).optional(),
  images: z.array(caseStudyImageSchema).max(5), // GAL-02 per-item cap (T-35-DOS) — the NESTED array (D-06)
});

export const caseStudyContentSchema = z.object({
  heading: z.string().max(100).optional(),
  items: z.array(caseStudyItemSchema).max(12), // Claude's-discretion cap (D-04/D-07; T-35-DOS)
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
  skills: skillsContentSchema, // CMS-08: additive new type — no Postgres migration (D-08)
  // 11-04 Step C1: the five marketer-vertical types for the `aurora` template. Additive,
  // profession-agnostic, NO Postgres migration (CMS-08) — same one-line-per-type idiom as
  // `skills`. The closed soft-enum set is now 13.
  education: educationContentSchema,
  metrics: metricsContentSchema,
  services: servicesContentSchema,
  moodboard: moodboardContentSchema,
  certifications: certificationsContentSchema,
  // 35-01: the two creative-vertical types (v2.8 "Show the Work"). Additive,
  // profession-agnostic, NO Postgres migration (CMS-08) — same one-line-per-type
  // idiom as `skills` / the marketer types. The closed soft-enum set is now 15.
  gallery: galleryContentSchema,
  case_study: caseStudyContentSchema,
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
export type BlogPreviewPostItem = z.infer<typeof blogPreviewPostItemSchema>;
export type BlogPreviewContent = z.infer<typeof blogPreviewContentSchema>;
export type SkillsContent = z.infer<typeof skillsContentSchema>;

// 11-04 Step C1 — marketer-vertical item + content types.
export type EducationItem = z.infer<typeof educationItemSchema>;
export type MetricItem = z.infer<typeof metricItemSchema>;
export type ServiceItem = z.infer<typeof serviceItemSchema>;
export type MoodboardImage = z.infer<typeof moodboardImageSchema>;
export type PaletteSwatch = z.infer<typeof paletteSwatchSchema>;
export type CertificationItem = z.infer<typeof certificationItemSchema>;

export type EducationContent = z.infer<typeof educationContentSchema>;
export type MetricsContent = z.infer<typeof metricsContentSchema>;
export type ServicesContent = z.infer<typeof servicesContentSchema>;
export type MoodboardContent = z.infer<typeof moodboardContentSchema>;
export type CertificationsContent = z.infer<typeof certificationsContentSchema>;

// 35-01 — creative-vertical item + content types.
export type GalleryImage = z.infer<typeof galleryImageSchema>;
export type GalleryContent = z.infer<typeof galleryContentSchema>;
export type CaseStudyImage = z.infer<typeof caseStudyImageSchema>;
export type CaseStudyItem = z.infer<typeof caseStudyItemSchema>;
export type CaseStudyContent = z.infer<typeof caseStudyContentSchema>;
