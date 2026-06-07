/**
 * Reusable page shell for edgerunner-v2 sub-pages (/services, /blog, etc.).
 *
 * Mirrors the outer wrapper of `edgerunner-v2/index.tsx` exactly:
 *   - Same tmpl-edgerunner-v2 root with fontVars + data-template-root + data-template-theme="dark"
 *   - themeInitScript('dark') FOUC guard
 *   - ambient bg div
 *   - Navbar wired with sub-page-aware nav items (anchor links → /${username}#id,
 *     Services → /${username}/services, Blog → /${username}/blog)
 *   - <main>{children}</main>
 *   - <Footer data={data} />
 *
 * The Navbar uses scroll-spy to highlight on-page section anchors. On a sub-page
 * there are no sections to spy on, so we pass `activeNav` as an override item id
 * that the NavbarSubpage component renders as active without scroll-spy.
 *
 * SERVER COMPONENT — no 'use client'.
 * PUBLIC ISR INVARIANT (D-22): no cookies()/headers()/host-read.
 */
import '../theme.css';

import type { ReactNode } from 'react';
import { orbitron, spaceGrotesk, vt323 } from '../fonts';
import { themeInitScript } from '../../_kit';
import { NavbarSubpage, type NavItem } from './navbar-subpage';
import { Footer } from '../sections/footer';
import type { PortfolioData } from '../../types';

export interface EdgerunnerV2PageShellProps {
  data: PortfolioData;
  /** The nav item id that should appear as active (e.g. "services", "blog") */
  activeNav: string;
  children: ReactNode;
}

export function EdgerunnerV2PageShell({
  data,
  activeNav,
  children,
}: EdgerunnerV2PageShellProps) {
  const { profile, sections } = data;
  const username = profile.username ?? '';

  const fontVars = `${orbitron.variable} ${spaceGrotesk.variable} ${vt323.variable}`;

  // Helper: does a section type exist?
  const has = (type: string) => sections.some((s) => s.type === type);

  // On a sub-page, anchor links go to /${username}#<id> so they navigate back to
  // the home-page section. Services and Blog are dedicated sub-pages.
  const navItems: NavItem[] = [
    { id: 'hero',       label: 'Home',       href: `/${username}#hero`       },
    ...(has('about')        ? [{ id: 'about',      label: 'About',      href: `/${username}#about`      }] : []),
    ...(has('experience')   ? [{ id: 'experience', label: 'Experience', href: `/${username}#experience` }] : []),
    ...(has('projects')     ? [{ id: 'projects',   label: 'Projects',   href: `/${username}#projects`   }] : []),
    ...(has('skills')       ? [{ id: 'stack',      label: 'Stack',      href: `/${username}#stack`      }] : []),
    ...(has('services')     ? [{ id: 'services',   label: 'Services',   href: `/${username}/services`   }] : []),
    ...(has('blog_preview') ? [{ id: 'blog',       label: 'Blog',       href: `/${username}/blog`       }] : []),
    ...(has('contact')      ? [{ id: 'contact',    label: 'Contact',    href: `/${username}#contact`    }] : []),
  ];

  // logoText: last word of display_name uppercased (stem, Navbar appends ".dev")
  // badge: first-letter of each name word joined by '_'
  const displayName = (profile.display_name ?? profile.username ?? '').trim();
  const nameParts = displayName.split(/\s+/).filter(Boolean);
  const logoText =
    nameParts.length > 0 ? nameParts[nameParts.length - 1].toUpperCase() : 'PORTFOLIO';
  const logoBadge =
    nameParts.length >= 2
      ? nameParts.map((w) => w[0].toUpperCase()).join('_')
      : logoText.slice(0, 2);

  return (
    <div
      className={`tmpl-edgerunner-v2 ${fontVars}`}
      data-template-root
      data-template-theme="dark"
    >
      {/* FOUC guard — hardcoded 'dark' (D-06) */}
      <script dangerouslySetInnerHTML={{ __html: themeInitScript('dark') }} />

      {/* Sticky pill navbar — sub-page variant (href-based, no scroll-spy) */}
      <NavbarSubpage
        items={navItems}
        logoText={logoText}
        badge={logoBadge}
        activeNav={activeNav}
        logoHref={`/${username}`}
      />

      {/* Page-wide ambient background */}
      <div aria-hidden="true" className="tmpl-ambient-bg" style={{ pointerEvents: 'none' }} />

      <main>{children}</main>

      <Footer data={data} />
    </div>
  );
}
