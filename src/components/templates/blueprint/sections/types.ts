/**
 * The SHARED, FROZEN section prop contract for the `blueprint` template. Mirrors
 * `atelier`/`aurora`/`minimal`/`editorial` sections/types.ts VERBATIM — the prop signatures
 * are part of the engine contract, NOT a per-template choice. Re-created here (rather than
 * imported from a sibling template) so the blueprint tree is self-contained (CTPL-04).
 *
 * NULLABILITY (LOAD-BEARING — see ../../types.ts): EVERY column on the underlying `public_*`
 * view Rows is nullable (`| null`) — including `id`, `type`, and `content`. Consumers MUST
 * null-guard before using any field. Each by-type section casts `section.content` to its
 * matching `*Content` type from `@/lib/validations` and owns its hide-if-empty path.
 */
import type { PortfolioData, PublicSection, PublicSettings } from '../../types';

/** The prop contract for the BY-TYPE sections — the single resolved `public_sections` row of
 *  the matching `type`, or `undefined` when the portfolio has no section of that type. */
export type SectionProps = { section: PublicSection | undefined };

/**
 * Contact-SCOPED additive props (Phase 25 — D-07/D-08). Public email/location/phone/socials
 * are read from `data.settings` (the SINGLE source of truth) and threaded into the Contact
 * section by `index.tsx`. The frozen global `SectionProps` is NOT widened.
 */
export interface ContactExtraProps {
  emailPublic?: string | null;
  location?: string | null;
  phone?: string | null;
  socials?: PublicSettings['socials'];
}

/** The prop contract for the FOOTER — reads `settings`/`profile`, so it takes the whole data. */
export type FooterProps = { data: PortfolioData };
