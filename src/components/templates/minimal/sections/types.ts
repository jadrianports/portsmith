/**
 * The SHARED, FROZEN section prop contract for the `minimal` template (TMPL-03 /
 * D-27 "the engine is the reusable part").
 *
 * This is the SINGLE source of truth for the prop signatures every section stub
 * AND every Wave-4/5 replacement (03-05/06/07/08) imports. It is written ONCE here
 * (03-04) so the parallel section-replacement is a pure DROP-IN body swap: a later
 * plan owns one `sections/*.tsx` file and replaces only the component BODY — never
 * the prop type, never the export name, never `index.tsx`. DO NOT CHANGE these
 * types in a downstream plan; widening or renaming them breaks the contract that
 * makes the parallel replacement safe.
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
 * FROZEN — do NOT change in 03-05/06/07/08.
 */
export type SectionProps = { section: PublicSection | undefined };

/**
 * The prop contract for the FOOTER. The footer reads `settings` (social links) and
 * `profile` rather than a single section row, so it takes the whole `PortfolioData`.
 * Absolute footer links go through `siteUrl()` (SHARED-B / PUB-03).
 *
 * FROZEN — do NOT change in 03-05/06/07/08.
 */
export type FooterProps = { data: PortfolioData };
