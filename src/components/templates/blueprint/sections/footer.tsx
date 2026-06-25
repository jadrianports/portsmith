/**
 * Footer (template chrome — NOT a by-type section) — FAITHFUL clone of the export's index
 * footer: a single hairline-topped mono row with "© YEAR · Name" on the left and the
 * "// END_OF_TRANSMISSION" sign-off on the right. Bound to the portfolio's real name (the
 * export's hardcoded "Dani Okonkwo" is placeholder content). Mirrors the FROZEN `FooterProps`
 * contract + `present()` + `siteUrl()` of the sibling templates.
 *
 * NO PLATFORM BRANDING (TMPL-07 / D-23): the URL is the only attribution. SAFETY AFFORDANCE
 * (SAFE-03): the one muted "Report this page" affordance (the shared token-only
 * `<ReportDialog>` island, reading the scoped `.tmpl-modal-*` tokens) when a portfolio id is
 * present.
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
  const year = new Date().getFullYear();

  return (
    <footer
      data-preview-region="contact"
      className="border-t px-6 py-10 mt-12"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="mx-auto max-w-[1100px] flex flex-wrap justify-between items-center gap-4">
        <a
          href={canonicalHref}
          className="bp-link-muted bp-mono text-[11px] tracking-wider uppercase"
          style={{ color: 'var(--muted-fg)', textDecoration: 'none' }}
        >
          © {year}
          {name ? ` · ${name}` : ''}
        </a>
        <div className="flex items-center gap-5">
          {portfolioId ? <ReportDialog portfolioId={portfolioId} /> : null}
          <span className="bp-mono text-[11px] tracking-wider uppercase" style={{ color: 'var(--muted-fg)' }}>
            // END_OF_TRANSMISSION
          </span>
        </div>
      </div>
    </footer>
  );
}
