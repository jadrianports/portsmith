/**
 * The SHARED, FROZEN section prop contract for the `edgerunner` template (PIPE-09).
 * Mirrors `aurora/sections/types.ts` + `minimal/sections/types.ts` VERBATIM — the prop
 * signatures are part of the engine contract, NOT a per-template choice. Re-created here
 * (rather than imported from a sibling template) so the edgerunner tree is
 * self-contained (D-17) and never reaches into `minimal/` or `aurora/`.
 *
 * TWO content shapes, two prop types:
 *   • The 7 BY-TYPE sections edgerunner supports (Hero, About, Metrics, Experience,
 *     Projects, Skills, Contact) receive a single resolved `section` row from
 *     `data.sections` — typed `SectionProps`. The row may be `undefined` when the
 *     portfolio has no section of that `type` (each section owns its hide-if-empty
 *     logic and returns `null`).
 *   • The FOOTER takes the WHOLE portfolio (`FooterProps`) because it reads `settings`
 *     social links + `profile`, not a single section row.
 *
 * NULLABILITY (LOAD-BEARING — see ../../types.ts): EVERY column on the underlying
 * `public_*` view Rows is nullable (`| null`) — including `id`, `type`, and `content`.
 * Consumers MUST null-guard (`?.` / `??`) before using any field.
 *
 * CONTENT CASTING: `section.content` is typed `Json | null` on the view Row. Each
 * by-type section casts it to its matching `*Content` type from `@/lib/validations`
 * (e.g. `HeroContent`, `MetricsContent`, `SkillsContent`, …) — the content already
 * passed `validateSectionContent` at seed/write time, so the cast is sound, but the
 * section still null-guards `content` itself and every field it reads.
 */
import type { PortfolioData, PublicSection } from '../../types';

/**
 * The prop contract for the 7 BY-TYPE sections. Each receives the single
 * `public_sections` row whose `type` matches the section, or `undefined` if the
 * portfolio has no section of that type. The section casts `section.content` to its
 * matching `*Content` type from `@/lib/validations` and owns its hide-if-empty path.
 *
 * FROZEN — the engine contract, identical to minimal's / aurora's.
 */
export type SectionProps = { section: PublicSection | undefined };

/**
 * The prop contract for the FOOTER. The footer reads `settings` (social links) and
 * `profile` rather than a single section row, so it takes the whole `PortfolioData`.
 * Absolute footer links go through `siteUrl()` (PUB-03).
 *
 * FROZEN — the engine contract, identical to minimal's / aurora's.
 */
export type FooterProps = { data: PortfolioData };
