/**
 * Footer (template chrome — NOT a by-type section). Translated from the export's
 * `synthwave-founder/src/components/layout/Footer.tsx`, collapsed to the single-scroll
 * shape (no nav links). The SHARED `FooterProps` signature + the `index.tsx` wiring are
 * UNCHANGED. The footer takes the WHOLE `PortfolioData` (`FooterProps`) because it reads
 * `settings` social links + `profile`, not a single section row.
 *
 * NO PLATFORM BRANDING (TMPL-07 / D-23): no platform tagline, logo, or link — the URL
 * is the ONLY attribution. The footer shows the founder's name/handle + the socials
 * that exist.
 *
 * SOCIALS (render-only-if-present): each link renders ONLY when its URL is a non-empty
 * string on `data.settings`, each passed through `safeHref` (http(s) only — drops a
 * dangerous/unparseable scheme rather than rendering a live `javascript:` link, CR-01).
 *
 * ABSOLUTE URLs (PUB-03 / SHARED-B): the canonical self-link is built from `siteUrl()`
 * (derived from `NEXT_PUBLIC_SITE_URL`, NEVER the request host — keeps the route
 * ISR-cacheable, blocks host-header injection).
 *
 * SAFETY AFFORDANCE (D-15 / SAFE-03 / TMPL-07): the footer carries ONE muted "Report
 * this page" `<button>` (the `<ReportDialog>` island) — the single sanctioned safety
 * element on the chrome-free public page. It renders only when a target portfolio id is
 * present on the public settings row.
 *
 * COLOR: no hardcoded hex for UI — every color via `var(--token)` (SHARED-D); the only
 * literal color is inside the documented decorative grid-horizon echo gradient.
 */
import { ReportDialog } from '@/components/public/report-dialog';

import type { FooterProps } from './types';
import { siteUrl } from '@/lib/url';
import { safeHref } from '@/lib/safe-url';
import { present } from './shared';

export function Footer({ data }: FooterProps) {
  const { profile, settings } = data;

  const name = present(profile.display_name) ? profile.display_name : null;
  const handle = present(profile.username) ? profile.username : null;

  const portfolioId = present(settings.portfolio_id) ? settings.portfolio_id : null;

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
      {/* Faint neon grid-horizon echo (a lower-opacity mirror of the hero grid). */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '60%',
          background:
            'repeating-linear-gradient(to right, var(--neon-cyan) 0 1px, transparent 1px 56px)',
          opacity: 0.05,
          transform: 'perspective(420px) rotateX(60deg)',
          transformOrigin: 'top',
          maskImage: 'linear-gradient(to bottom, #000, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, #000, transparent)',
          pointerEvents: 'none',
        }}
      />

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
                fontSize: '16px',
                letterSpacing: '0.04em',
                color: 'var(--muted-fg)',
                textDecoration: 'none',
              }}
            >
              {canonicalLabel}
            </a>
          ) : null}
        </div>

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
                      fontSize: '16px',
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
            fontSize: '16px',
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
