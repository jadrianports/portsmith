/**
 * Footer — the slim closing utility band (D-06).
 *
 * A `<footer>` with a `border-t border-border` hairline holding the wordmark, the two
 * `/legal` links (Terms / Privacy via the `Link` primitive — copper-on-hover), and a
 * `--color-muted-foreground` copyright line. No newsletter, no sitemap, no social row
 * (out of the focused-single-page scope). Deliberately non-focal — subordinate to the
 * final CTA above it. Stacks on mobile, single row on desktop. Chrome tokens only.
 */
import Link from 'next/link';

import { Link as TextLink } from '@/components/ui/link';

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Link
          href="/"
          className="rounded-sm font-semibold text-brand outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {/* D-10 DRAFT — James approves */}
          Portsmith
        </Link>
        <nav className="flex items-center gap-6">
          {/* D-10 DRAFT — James approves */}
          <TextLink href="/legal">Terms</TextLink>
          {/* D-10 DRAFT — James approves */}
          <TextLink href="/legal">Privacy</TextLink>
        </nav>
        {/* D-10 DRAFT — James approves */}
        <p className="text-sm text-muted-foreground">© 2026 Portsmith</p>
      </div>
    </footer>
  );
}
