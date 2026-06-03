/**
 * Footer (template chrome — NOT a by-type section) — the Newsprint editorial colophon
 * (07-UI-SPEC A.7 §Footer). Mirrors `minimal/sections/footer.tsx`'s FROZEN
 * `FooterProps` contract + `present()` + `safeHref` + `siteUrl()` EXACTLY; the visual
 * body is the editorial colophon. The footer takes the WHOLE `PortfolioData`
 * (`FooterProps`) because it reads `settings` social links + `profile`.
 *
 * NO PLATFORM BRANDING (TMPL-07 / D-23): no platform tagline, no platform logo, no
 * platform link anywhere — the URL is the ONLY attribution. The footer shows the
 * owner's name/handle + the social links that exist, as a ruled colophon.
 *
 * SOCIALS (render-only-if-present — hide-if-empty): each link renders ONLY when its
 * URL is a non-empty string on `data.settings` (github_url / linkedin_url /
 * twitter_url / dribbble_url / website_url). CR-01: each passes through `safeHref`.
 *
 * ABSOLUTE URLs (PUB-03 / D-22): the canonical self-link is built from `siteUrl()` —
 * derived from `NEXT_PUBLIC_SITE_URL`, NEVER the request host (keeps the route
 * ISR-cacheable and blocks host-header injection). External social URLs are stored
 * absolute and used as-is.
 *
 * THEME TOGGLE: `index.tsx` already mounts `ThemeToggle` (gated on
 * `visitor_theme_toggle`) — the footer does NOT double-mount it.
 *
 * REPORT AFFORDANCE (intentionally OMITTED this phase): `minimal`'s footer mounts the
 * shared `<ReportDialog>` (SAFE-03), but that island is minimal-COUPLED — it hardcodes
 * minimal's synthwave hexes + reads `var(--sunset-gradient)` (a token `.tmpl-editorial`
 * does not define) + the `.tmpl-modal-*` keyframes scoped to `.tmpl-minimal`. Wiring it
 * as-is would bleed minimal tokens and render a broken (missing-gradient) dialog on the
 * Newsprint page (a D-17 / aesthetic-contract violation). The 07-03 plan's footer
 * action scopes this footer to "name/handle + socials + colophon, NO platform branding"
 * and does NOT include the report dialog. Editorial is not yet a public render target
 * (that lands in 07-04); a Newsprint-scoped report affordance is a follow-up for when
 * it becomes publicly renderable. Tracked as a deferred item.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import type { FooterProps } from './types';
import { siteUrl } from '@/lib/url';
import { safeHref } from '@/lib/safe-url';

/** A URL field is "present" when it is a non-empty trimmed string. */
function present(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function Footer({ data }: FooterProps) {
  const { profile, settings } = data;

  // Name/handle (null-guarded view columns).
  const name = present(profile.display_name) ? profile.display_name : null;
  const handle = present(profile.username) ? profile.username : null;

  // The social links that exist, in a stable order. NO platform link. CR-01: each URL
  // passes through `safeHref` (http(s) only) — a dangerous/unparseable scheme drops
  // that social entirely rather than rendering a live `javascript:` link.
  const socialSources: { label: string; raw: string | null | undefined }[] = [
    { label: 'GitHub', raw: settings.github_url },
    { label: 'LinkedIn', raw: settings.linkedin_url },
    { label: 'X', raw: settings.twitter_url },
    { label: 'Dribbble', raw: settings.dribbble_url },
    { label: 'Website', raw: settings.website_url },
  ];
  const socials: { label: string; href: string }[] = [];
  for (const { label, raw } of socialSources) {
    const href = safeHref(raw);
    if (href) socials.push({ label, href });
  }

  // The canonical self-link to this portfolio (PUB-03 — env-driven, host-safe).
  const canonicalHref = handle ? siteUrl(`/${handle}`) : siteUrl('/');
  const canonicalLabel = handle
    ? `${siteUrl(`/${handle}`).replace(/^https?:\/\//, '')}`
    : null;

  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        marginTop: '96px',
        paddingTop: '48px',
        paddingBottom: '48px',
        borderTop: '1px solid var(--fg)',
      }}
    >
      {/* Colophon content row — name/handle + the canonical URL + socials, ruled. */}
      <div
        className="tmpl-shell"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '24px',
        }}
      >
        {/* Name / handle + the canonical URL (the ONLY attribution — TMPL-07). */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {name ? (
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '18px',
                color: 'var(--fg)',
              }}
            >
              {name}
            </span>
          ) : null}
          {canonicalLabel ? (
            <a
              href={canonicalHref}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                letterSpacing: '0.04em',
                color: 'var(--muted-fg)',
                textDecoration: 'none',
              }}
            >
              {canonicalLabel}
            </a>
          ) : null}
        </div>

        {/* Social links — only the ones that exist. */}
        {socials.length > 0 ? (
          <nav aria-label="Social links">
            <ul
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '24px',
                listStyle: 'none',
                margin: 0,
                padding: 0,
              }}
            >
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer me"
                    className="tmpl-project-link"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      minHeight: '44px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.14em',
                    }}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {/* Copyright line — the owner's name only; NO platform attribution. */}
      <div
        className="tmpl-shell"
        style={{
          marginTop: '32px',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            letterSpacing: '0.04em',
            color: 'var(--muted-fg)',
          }}
        >
          © {year}
          {name ? ` ${name}` : ''}
        </p>
      </div>
    </footer>
  );
}
