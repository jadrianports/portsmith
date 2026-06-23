/**
 * Footer (template chrome — NOT a by-type section) — a FAITHFUL clone of the export's
 * `Footer.tsx`: a single hairline-topped `py-10` row with a left mark (an accent monogram
 * + a "© YEAR · Name" kicker), a center "All rights reserved" kicker, and a right
 * "Back to top ↑" anchor. Mirrors `aurora`/`minimal`/`editorial` footer's FROZEN
 * `FooterProps` contract + `present()` + `siteUrl()`.
 *
 * NO PLATFORM BRANDING (TMPL-07 / D-23): no platform tagline, logo, or link anywhere — the
 * URL is the ONLY attribution. The export's hardcoded "NK." monogram + "Kovac/Bureau"
 * copy are placeholder content; the structural row (mark + copyright + back-to-top) is
 * reproduced EXACTLY, bound to the portfolio's own name/handle.
 *
 * ABSOLUTE URLs (PUB-03 / D-22): the canonical self-link is built from `siteUrl()`
 * (NEXT_PUBLIC_SITE_URL), NEVER the request host.
 *
 * SAFETY AFFORDANCE (SAFE-03 / TMPL-07): the footer carries the ONE muted "Report this
 * page" affordance (the shared token-only `<ReportDialog>` island), rendering only when a
 * target portfolio id is present. It reads the per-template `.tmpl-modal-*` tokens atelier
 * defines (acid-on-black), NO cross-template bleed.
 *
 * COLOR: no hardcoded hex — every value reads a scoped `var(--token)` from theme.css.
 */
import { ReportDialog } from '@/components/public/report-dialog';

import type { FooterProps } from './types';
import { siteUrl } from '@/lib/url';
import { kickerStyle, present } from './shared';

export function Footer({ data }: FooterProps) {
  const { profile, settings } = data;

  const name = present(profile.display_name) ? profile.display_name : null;
  const handle = present(profile.username) ? profile.username : null;

  const portfolioId = present(settings.portfolio_id) ? settings.portfolio_id : null;

  const canonicalHref = handle ? siteUrl(`/${handle}`) : siteUrl('/');

  // The accent monogram — the first letter(s) of the display name (the export's "NK.").
  const monogram = name
    ? name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w.charAt(0))
        .join('')
        .toUpperCase()
    : null;

  const year = new Date().getFullYear();

  return (
    <footer
      // Render-only owner-preview anchor (Phase 27 / D-06): the edit-preview bridge reads
      // this region tag to route a footer click → the Contact & Socials panel.
      data-preview-region="contact"
      style={{
        borderTop: '1px solid var(--border-strong)',
        paddingBlock: '40px',
      }}
    >
      <div
        className="tmpl-shell"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        {/* LEFT — accent monogram + © YEAR · Name. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {monogram ? (
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.125rem',
                color: 'var(--accent)',
              }}
            >
              {monogram}.
            </span>
          ) : null}
          <span style={{ ...kickerStyle, color: 'var(--muted-fg)' }}>
            © {year}
            {name ? ` ${name}` : ''}
          </span>
        </div>

        {/* CENTER — self-link / rights line. */}
        <a href={canonicalHref} className="tmpl-link" style={{ ...kickerStyle, color: 'var(--muted-fg)', textDecoration: 'none' }}>
          All rights reserved
        </a>

        {/* RIGHT — back to top + the report affordance. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <a href="#top" className="tmpl-link" style={{ ...kickerStyle, color: 'var(--muted-fg)', textDecoration: 'none' }}>
            Back to top ↑
          </a>
          {portfolioId ? <ReportDialog portfolioId={portfolioId} /> : null}
        </div>
      </div>
    </footer>
  );
}
