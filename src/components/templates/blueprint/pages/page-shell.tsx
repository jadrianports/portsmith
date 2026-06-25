/**
 * Reusable page shell for blueprint sub-pages (/blog, /blog/[slug]). Mirrors the OUTER wrapper
 * of `blueprint/index.tsx`: the `.tmpl-blueprint` root + fontVars + `data-template-theme="dark"`,
 * `<main>`, and the blueprint `<Footer>`. NO `themeInitScript` (dark-only; a raw <script> in a
 * client-navigated component throws the React 19 "script tag while rendering" error — gotcha 4).
 * The export's blog pages use a per-page minimal header (rendered inside the content), NOT the
 * single-scroll StickyNav, so this shell omits the nav.
 *
 * SERVER COMPONENT. PUBLIC ISR INVARIANT (D-22): no cookies()/headers()/host-read.
 */
import '../theme.css';

import type { ReactNode } from 'react';

import { ibmPlexSans, jetBrainsMono, spaceGrotesk } from '../fonts';
import { Footer } from '../sections/footer';
import type { PortfolioData } from '../../types';

export function BlueprintPageShell({ data, children }: { data: PortfolioData; children: ReactNode }) {
  const fontVars = `${spaceGrotesk.variable} ${ibmPlexSans.variable} ${jetBrainsMono.variable}`;
  return (
    <div className={`tmpl-blueprint ${fontVars}`} data-template-root data-template-theme="dark">
      <main>{children}</main>
      <Footer data={data} />
    </div>
  );
}
