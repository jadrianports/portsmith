/**
 * <Lockup> — the combined horizontal mark + wordmark (D-14). Pure Server Component.
 *
 * Horizontal inline-flex row: <Logo> + an 8px (`gap-2`) gap + <Wordmark>. Per D-14
 * the wordmark is hidden below the `sm` breakpoint so the lockup COLLAPSES to
 * mark-only on narrow screens (`hidden sm:inline`).
 *
 * A11y: the <Logo> here is `decorative` (→ `aria-hidden`); the live <Wordmark>
 * text carries the accessible name, so the lockup announces once as "Portsmith".
 *
 * The lockup is NOT itself a link — call sites wrap it in their existing <Link>
 * (e.g. the header `href="/"`), keeping it a single focusable unit that preserves
 * each surface's existing focus ring.
 */
import { Logo } from './logo';
import { Wordmark } from './wordmark';

export function Lockup({
  logoSize,
  wordmarkClassName,
}: {
  logoSize?: number;
  wordmarkClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Logo decorative size={logoSize} />
      {/* D-14: wordmark hidden below `sm` → lockup collapses to mark-only. */}
      <Wordmark className={`hidden sm:inline ${wordmarkClassName ?? ''}`} />
    </span>
  );
}
