'use client';

/**
 * AdminNav (12-05) — the minimal two-tab `(admin)` navigation: "Trust & Safety"
 * (/admin) and "Templates" (/admin/templates). The `(admin)` group had no nav
 * before this phase (only the gate layout + the single report page); GATE-04 adds
 * a second operator surface, so this small tab bar lets the operator move between
 * the two.
 *
 * CHROME layer (Evergreen & Copper, Inter): Tailwind utilities → `globals.css
 * @theme` tokens + lucide glyphs ONLY; NO template `.tmpl-*` tokens (two-layer
 * isolation, SHARED-E). The copper accent (`text-accent` / the accent underline) is
 * reserved for the ACTIVE tab marker — never a fill.
 *
 * `'use client'` so it can read the current path (`usePathname`) to indicate the
 * active tab; it renders only static links, so it adds no server data to the client
 * bundle. The active tab also carries `aria-current="page"` (not color alone).
 *
 * Source: `next/navigation` `usePathname`; `next/link`; the chrome-token discipline
 * from `report-queue.tsx:5-7`.
 */
import { LayoutTemplate, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin', label: 'Trust & Safety', Icon: ShieldAlert },
  { href: '/admin/templates', label: 'Templates', Icon: LayoutTemplate },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin"
      className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6 lg:px-8"
    >
      <ul className="flex items-center gap-1 border-b border-border">
        {TABS.map(({ href, label, Icon }) => {
          // /admin is active ONLY on the exact path (so it doesn't light up under
          // /admin/templates); /admin/templates is active on its own subtree.
          const active =
            href === '/admin'
              ? pathname === '/admin'
              : pathname === href || pathname.startsWith(href + '/');
          return (
            <li key={href} className="list-none">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={
                  'inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold ' +
                  'outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
                  'focus-visible:outline-ring motion-reduce:transition-none ' +
                  (active
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted-foreground hover:text-foreground')
                }
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
