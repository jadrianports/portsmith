/**
 * `buildPersonLd` — the pure, template-agnostic schema.org `Person` JSON-LD
 * builder (SEO-01 / D-08; RESEARCH "Code Examples" → Person JSON-LD).
 *
 * One data-driven SEO engine reading the already-assembled `PortfolioData`: it is
 * a PURE function (no I/O, no DB, no request access) so any template can render its
 * output as a server-side `<script type="application/ld+json">`. Templates 2-3
 * (Phase 7) inherit correct structured data for free by calling this same builder.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ LOAD-BEARING (PUB-03 / T-06-06): the `url` is ALWAYS `siteUrl('/'+username)` — │
 * │ derived from `NEXT_PUBLIC_SITE_URL`, NEVER the request host. A request-host    │
 * │ read here would (a) let host-header injection poison the JSON-LD `url` and (b) │
 * │ re-introduce request-time dynamism on the ISR public route (D-22). siteUrl()   │
 * │ is the single host-safe origin source (verified url.ts).                       │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * OPTIONAL FIELDS ARE OMITTED (not emitted empty): `image` only when the profile
 * has an `avatar_url`; `jobTitle` only when it has a `headline`. `sameAs` is the
 * filtered, non-null set of the configured social links (an empty array when none).
 *
 * SECURITY (T-06-09): the values returned here are schema-shaped, server-controlled
 * primitives only — the consuming template serializes them via `JSON.stringify`
 * (which escapes them) into the `<script>` body. No free-form user HTML is ever
 * injected, mirroring the existing FOUC-script discipline in `minimal/index.tsx`.
 */
import type { PortfolioData } from '@/components/templates/types';
import { siteUrl } from '@/lib/url';

/** The schema.org `Person` shape this builder emits (optional fields omitted). */
export interface PersonLd {
  '@context': 'https://schema.org';
  '@type': 'Person';
  name: string;
  url: string;
  image?: string;
  jobTitle?: string;
  sameAs?: string[];
}

/**
 * Build the `Person` JSON-LD object for a portfolio. PURE — no I/O. `name` falls
 * back to `username` when `display_name` is absent; `url` is always the env-driven
 * `siteUrl('/'+username)` (never the request host — PUB-03).
 */
export function buildPersonLd(data: PortfolioData, username: string): PersonLd {
  const { profile, settings } = data;

  // The configured social links, in a stable order, with null/blank entries dropped.
  const sameAs = [settings.github_url, settings.linkedin_url, settings.twitter_url].filter(
    (u): u is string => !!u,
  );

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.display_name ?? username,
    url: siteUrl(`/${username}`),
    ...(profile.avatar_url ? { image: profile.avatar_url } : {}),
    ...(profile.headline ? { jobTitle: profile.headline } : {}),
    sameAs,
  };
}
