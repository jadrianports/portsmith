/**
 * Footer — the slim closing utility band (D-06).
 *
 * A `<footer>` with a `border-t border-border` hairline holding the wordmark, the `/explore`
 * discovery link (D-13 — the persistent home for the public gallery), the two legal links
 * (Terms → `/legal#terms-heading`, Privacy → `/legal#privacy-heading` via the `Link` primitive
 * — copper-on-hover; the combined `/legal` page anchors both), and a
 * `--color-muted-foreground` copyright line. No newsletter, no sitemap, no social row
 * (out of the focused-single-page scope). Deliberately non-focal — subordinate to the
 * final CTA above it. Stacks on mobile, single row on desktop. Chrome tokens only.
 */
import Link from 'next/link';

import { Lockup } from '@/components/brand/lockup';
import { Link as TextLink } from '@/components/ui/link';

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Link
          href="/"
          className="rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Lockup />
        </Link>
        <nav className="flex items-center gap-6">
          <TextLink href="/explore">Explore portfolios</TextLink>
          <TextLink href="/legal#terms-heading">Terms</TextLink>
          <TextLink href="/legal#privacy-heading">Privacy</TextLink>
        </nav>
        <p className="text-sm text-muted-foreground">© 2026 Portsmith</p>
      </div>
    </footer>
  );
}
