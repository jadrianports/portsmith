/**
 * Footer (template chrome — NOT a by-type section). STUB — frozen against the
 * SHARED `FooterProps` contract (takes the whole `PortfolioData`, not a section
 * row); 03-05 replaces ONLY this body. The signature and `index.tsx` wiring NEVER
 * change.
 *
 * When implemented: NO platform branding (TMPL-07 / D-23 — the URL is the only
 * attribution); render only the social links that exist in `data.settings`; build
 * any absolute URL via `siteUrl()` (SHARED-B / PUB-03). Read `--token`s.
 */
import type { FooterProps } from './types';

export function Footer({ data }: FooterProps) {
  void data;
  return null;
}
