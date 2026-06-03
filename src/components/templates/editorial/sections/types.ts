/**
 * The SHARED, FROZEN section prop contract for the `editorial` / "Newsprint"
 * template (TMPL-01 / D-P7-10 "the engine is the reusable part"). Mirrors
 * `minimal/sections/types.ts` VERBATIM (07-PATTERNS SHARED-6) — the prop signatures
 * are part of the engine contract, NOT a per-template choice. Re-created here (rather
 * than imported from `minimal`) so the editorial tree is self-contained (SHARED-5 /
 * D-17) and never reaches into `minimal/`.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ TWO content shapes, two prop types:                                          │
 * │                                                                              │
 * │ • The 7 BY-TYPE sections (Hero, About, Skills, Projects, Experience,         │
 * │   Testimonials, Contact) receive a single resolved `section` row from        │
 * │   `data.sections` — typed `SectionProps`. The row may be `undefined` when     │
 * │   the portfolio has no section of that `type` (each section owns its own      │
 * │   hide-if-empty logic and returns `null`).                                    │
 * │                                                                              │
 * │ • The FOOTER takes the WHOLE portfolio (`FooterProps`) because it reads       │
 * │   `settings` social links + `profile`, not a single section row.             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * NULLABILITY (LOAD-BEARING — see ../../types.ts): EVERY column on the underlying
 * `public_*` view Rows is nullable (`| null`) — including `id`, `type`, and
 * `content`. Consumers MUST null-guard (`?.` / `??`) before using any field.
 *
 * CONTENT CASTING: `section.content` is typed `Json | null` on the view Row. Each
 * by-type section casts it to its matching `*Content` type from `@/lib/validations`
 * (e.g. `HeroContent`, `AboutContent`, `SkillsContent`, …) — the content already
 * passed `validateSectionContent` at seed/write time, so the cast is sound, but the
 * section still null-guards `content` itself and every field it reads.
 */
import type { PortfolioData, PublicSection } from '../../types';

/**
 * The prop contract for the 7 BY-TYPE sections. Each section receives the single
 * `public_sections` row whose `type` matches the section, or `undefined` if the
 * portfolio has no section of that type. The section casts `section.content` to its
 * matching `*Content` type from `@/lib/validations` and owns its hide-if-empty path
 * (returns `null` when there is nothing to render).
 *
 * FROZEN — the engine contract, identical to minimal's.
 */
export type SectionProps = { section: PublicSection | undefined };

/**
 * The prop contract for the FOOTER. The footer reads `settings` (social links) and
 * `profile` rather than a single section row, so it takes the whole `PortfolioData`.
 * Absolute footer links go through `siteUrl()` (PUB-03).
 *
 * FROZEN — the engine contract, identical to minimal's.
 */
export type FooterProps = { data: PortfolioData };
