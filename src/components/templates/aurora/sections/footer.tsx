/**
 * Footer (template chrome — NOT a by-type section) — the aurora colophon (translated from
 * `marketing-girl/src/components/Footer.tsx`, stripped of the source's hardcoded social
 * links + nav). Mirrors `minimal`/`editorial` footer's FROZEN `FooterProps` contract +
 * `present()` + `safeHref` + `siteUrl()` EXACTLY. The footer takes the WHOLE
 * `PortfolioData` because it reads `settings` social links + `profile`.
 *
 * NO PLATFORM BRANDING (TMPL-07 / D-23): no platform tagline, logo, or link anywhere —
 * the URL is the ONLY attribution. The source's "Made with ❤" + nav are dropped.
 *
 * NO SOCIAL ROW (Phase 25 — D-05): the aurora footer carries NO social links. The
 * marketing-girl original footer had NONE; socials live in the Contact section's
 * "Follow Me" block (restored 1:1). The old 5-column `*_url` loop is REMOVED — the footer
 * keeps name/handle + the `siteUrl()` self-link + the report affordance only.
 *
 * ABSOLUTE URLs (PUB-03 / D-22): the canonical self-link is built from `siteUrl()`
 * (NEXT_PUBLIC_SITE_URL), NEVER the request host. External social URLs are used as-is.
 *
 * SAFETY AFFORDANCE (D-15 / SAFE-03 / TMPL-07): the footer carries the ONE muted "Report
 * this page" `<button>` (the shared token-only `<ReportDialog>` island), rendering only
 * when a target portfolio id is present on the public settings row. It reads the
 * per-template `.tmpl-modal-*` tokens aurora defines (rose treatment), NO cross-template bleed.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import { ReportDialog } from '@/components/public/report-dialog';

import type { FooterProps } from './types';
import { siteUrl } from '@/lib/url';
import { present } from './shared';

export function Footer({ data }: FooterProps) {
  const { profile, settings } = data;

  const name = present(profile.display_name) ? profile.display_name : null;
  const handle = present(profile.username) ? profile.username : null;

  const portfolioId = present(settings.portfolio_id) ? settings.portfolio_id : null;

  const canonicalHref = handle ? siteUrl(`/${handle}`) : siteUrl('/');
  const canonicalLabel = handle ? siteUrl(`/${handle}`).replace(/^https?:\/\//, '') : null;

  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        marginTop: '96px',
        paddingTop: '48px',
        paddingBottom: '48px',
        borderTop: '1px solid var(--border)',
      }}
    >
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
      </div>

      <div
        className="tmpl-shell"
        style={{
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
