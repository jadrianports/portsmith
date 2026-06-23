/**
 * The SHARED, FROZEN section prop contract for the `atelier` template (36-02). Mirrors
 * `aurora/sections/types.ts` + `minimal`/`editorial` VERBATIM — the prop signatures are
 * part of the engine contract, NOT a per-template choice. Re-created here (rather than
 * imported from a sibling template) so the atelier tree is self-contained (CTPL-04) and
 * never reaches into another template's folder.
 *
 * TWO content shapes, two prop types:
 *   • The BY-TYPE sections atelier supports (Hero, About, Gallery, CaseStudy, Projects,
 *     Testimonials, Contact, Moodboard) receive a single resolved `section` row from
 *     `data.sections` — typed `SectionProps`. The row may be `undefined` when the
 *     portfolio has no section of that `type` (each section owns its own hide-if-empty
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
 * (e.g. `HeroContent`, `GalleryContent`, `CaseStudyContent`, …) — the content already
 * passed `validateSectionContent` at seed/write time, so the cast is sound, but the
 * section still null-guards `content` itself and every field it reads.
 */
import type { PortfolioData, PublicSection, PublicSettings } from '../../types';

/**
 * The prop contract for the BY-TYPE sections. Each section receives the single
 * `public_sections` row whose `type` matches the section, or `undefined` if the
 * portfolio has no section of that type. The section casts `section.content` to its
 * matching `*Content` type from `@/lib/validations` and owns its hide-if-empty path.
 *
 * FROZEN — the engine contract, identical to aurora's / minimal's / editorial's.
 */
export type SectionProps = { section: PublicSection | undefined };

/**
 * Contact-SCOPED additive props (Phase 25 — D-07/D-08). The public email, location,
 * phone, and socials are read from `data.settings` (the SINGLE source of truth) and
 * threaded into the Contact section by `index.tsx`. The frozen global `SectionProps` is
 * NOT widened (D-08) — these are Contact-scoped only. `socials` is the `settings.socials`
 * JSONB value (`Json | null` on the view Row — consumers `Array.isArray`-guard it).
 */
export interface ContactExtraProps {
  emailPublic?: string | null;
  location?: string | null;
  phone?: string | null;
  socials?: PublicSettings['socials'];
}

/**
 * The prop contract for the FOOTER. The footer reads `settings` (social links) and
 * `profile` rather than a single section row, so it takes the whole `PortfolioData`.
 * Absolute footer links go through `siteUrl()` (PUB-03).
 *
 * FROZEN — the engine contract, identical to aurora's / minimal's / editorial's.
 */
export type FooterProps = { data: PortfolioData };
