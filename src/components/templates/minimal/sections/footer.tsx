/**
 * Footer (template chrome — NOT a by-type section). Replaces the 03-04 stub: the
 * body is real, the SHARED `FooterProps` signature and the `index.tsx` wiring are
 * UNCHANGED (frozen 03-04 contract). The footer takes the WHOLE `PortfolioData`
 * (`FooterProps`) because it reads `settings` social links + `profile`, not a
 * single section row.
 *
 * NO PLATFORM BRANDING (TMPL-07 / D-23): no platform tagline, no platform logo,
 * and no platform link anywhere here — the URL is the ONLY attribution. The footer
 * shows the founder's name/handle + the social links that exist.
 *
 * SOCIALS (render-only-if-present — hide-if-empty): each link renders ONLY when its
 * URL is a non-empty string on `data.settings` (github_url / linkedin_url /
 * twitter_url / dribbble_url / website_url).
 *
 * ABSOLUTE URLs (PUB-03 / SHARED-B): the canonical self-link to this portfolio is
 * built from `siteUrl()` — derived from `NEXT_PUBLIC_SITE_URL`, NEVER the request
 * host (keeps the route ISR-cacheable and blocks host-header injection). The
 * external social URLs are stored absolute and are used as-is.
 *
 * THEME TOGGLE: `index.tsx` already mounts `ThemeToggle` (gated on
 * `visitor_theme_toggle`) — the footer does NOT double-mount it.
 *
 * COLOR: no hardcoded hex for UI — every color via `var(--token)` (SHARED-D); the
 * only literal color is inside the documented decorative grid-horizon echo
 * gradient (the footer's faint sunset mirror of the hero).
 *
 * SAFETY AFFORDANCE (D-15 / SAFE-03 / TMPL-07): the footer carries ONE muted "Report
 * this page" `<button>` (the `<ReportDialog>` island) — the single sanctioned safety
 * element on the chrome-free public page. It is a real `<button>` (the dialog is
 * client-side, NOT an `<a href>`), styled quieter than the social links so it never
 * competes with the portfolio. It renders only when a target portfolio id is present
 * on the public settings row (`data.settings.portfolio_id`).
 */
import { ReportDialog } from '@/components/public/report-dialog';

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

  // The target for the report dialog — the portfolio id on the public settings row
  // (`portfolio_id` is `string | null` on the view, so null-guard). Absent → omit the
  // affordance rather than render a dead button (never a report path to nowhere).
  const portfolioId = present(settings.portfolio_id) ? settings.portfolio_id : null;

  // The social links that exist, in a stable order. NO platform link. CR-01: each
  // URL passes through `safeHref` (http(s) only) — a dangerous/unparseable scheme
  // drops that social entirely rather than rendering a live `javascript:` link.
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
  const canonicalLabel = handle ? `${siteUrl(`/${handle}`).replace(/^https?:\/\//, '')}` : null;

  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        position: 'relative',
        marginTop: '96px',
        paddingTop: '48px',
        paddingBottom: '48px',
        borderTop: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Faint grid-horizon echo (a lower-opacity mirror of the hero horizon). */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '60%',
          background:
            'repeating-linear-gradient(to right, var(--accent-cyan) 0 1px, transparent 1px 56px)',
          opacity: 0.05,
          transform: 'perspective(420px) rotateX(60deg)',
          transformOrigin: 'top',
          maskImage: 'linear-gradient(to bottom, #000, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, #000, transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* Footer CONTENT is shelled (centered max-width + gutter); the decorative
          grid-horizon echo above is a full-bleed sibling outside the shell. */}
      <div
        className="tmpl-shell"
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
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
                fontSize: '16px',
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
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      minHeight: '44px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      color: 'var(--fg)',
                      textDecoration: 'none',
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

      {/* Copyright line — the owner's name only; NO platform attribution. The ONE
          sanctioned safety affordance (the muted "Report this page" button, D-15)
          rides this row, kept visually quieter than the social links. Shelled (same
          centered max-width + gutter) so it aligns under the content row. */}
      <div
        className="tmpl-shell"
        style={{
          position: 'relative',
          zIndex: 1,
          marginTop: '32px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
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

        {portfolioId ? <ReportDialog portfolioId={portfolioId} /> : null}
      </div>
    </footer>
  );
}
