'use client';

/**
 * AdminNav (12-05; extended 15-04) — the `(admin)` navigation tab bar:
 * "Trust & Safety" (/admin), "Templates" (/admin/templates), and "Insights"
 * (/admin/insights). The `(admin)` group had no nav before 12-05 (only the gate
 * layout + the single report page); 12-05 added the second operator surface, and
 * 15-04 adds the third — the operator Insights surface (D-14) — so this small tab
 * bar lets the operator move between the three.
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
import { LayoutTemplate, LineChart, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Lockup } from '@/components/brand/lockup';

const TABS = [
  { href: '/admin', label: 'Trust & Safety', Icon: ShieldAlert },
  { href: '/admin/templates', label: 'Templates', Icon: LayoutTemplate },
  // D-14: the 3rd operator surface — passive Insights (Traffic + Abuse). Lights
  // on its own subtree; /admin stays exact-only below so it doesn't light here.
  { href: '/admin/insights', label: 'Insights', Icon: LineChart },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin"
      className="mx-auto flex w-full max-w-2xl items-center gap-4 px-4 pt-4 sm:px-6 lg:px-8"
    >
      {/* 32-03 (D-13): compact brand mark LEFT of the tab bar — slots inline, NO
          redesign of the tabs. Shared <Lockup> (sm-collapse) in a focus-ringed Link;
          the tab entries + active-state copper underline below are untouched. */}
      <Link
        href="/admin"
        className="rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Lockup />
      </Link>
      <ul className="flex flex-1 items-center gap-1 self-end border-b border-border">
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
