/**
 * Reusable page shell for edgerunner-v2 sub-pages (/services, /blog, etc.).
 *
 * Mirrors the outer wrapper of `edgerunner-v2/index.tsx` exactly:
 *   - Same tmpl-edgerunner-v2 root with fontVars + data-template-root + data-template-theme="dark"
 *   - no themeInitScript (dark-only; removed to fix client-nav React script error)
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
import { CommandPaletteLazy } from '../sections/command-palette-lazy';
import { MotionProvider } from '../sections/motion-provider';
import type { CommandItem } from '../sections/command-palette';
import { NavbarSubpage, type NavItem } from './navbar-subpage';
import { Footer } from '../sections/footer';
import { ScrollProgress } from '../sections/scroll-progress';
import { safeHref } from '@/lib/safe-url';
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

  // ── CommandPalette props ──────────────────────────────────────────────────
  // On sub-pages, sections that are on the homepage use /${username}#anchor navigation;
  // real routes (services, blog) keep their href.
  const cmdItems: CommandItem[] = [
    { label: 'Home',       anchor: 'hero'                                },
    ...(has('about')        ? [{ label: 'About',      anchor: 'about'      }] : []),
    ...(has('experience')   ? [{ label: 'Experience', anchor: 'experience' }] : []),
    ...(has('projects')     ? [{ label: 'Projects',   anchor: 'projects'   }] : []),
    ...(has('skills')       ? [{ label: 'Stack',      anchor: 'stack'      }] : []),
    ...(has('services')     ? [{ label: 'Services',   href: `/${username}/services` }] : []),
    ...(has('blog_preview') ? [{ label: 'Blog',       href: `/${username}/blog`     }] : []),
    ...(has('contact')      ? [{ label: 'Contact',    anchor: 'contact'    }] : []),
  ];

  // Social links for the palette
  const cmdSocials = (
    [
      { label: 'GitHub',   href: safeHref(data.settings.github_url)   },
      { label: 'LinkedIn', href: safeHref(data.settings.linkedin_url) },
      { label: 'X',        href: safeHref(data.settings.twitter_url)  },
      { label: 'Dribbble', href: safeHref(data.settings.dribbble_url) },
    ] as Array<{ label: string; href: string | undefined }>
  ).filter((s): s is { label: string; href: string } => typeof s.href === 'string');

  // Resume URL and email for the palette
  const cmdResumeUrl = safeHref(
    (sections.find((s) => s.type === 'hero')?.content as { resume_url?: string | null } | null)?.resume_url
  ) ?? null;
  const cmdEmail = data.settings.email_public ?? null;

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
      {/* No themeInitScript here — edgerunner-v2 is dark-only; the hardcoded
          data-template-theme="dark" on the root div is sufficient. Rendering a
          raw <script> in a client-navigated component causes the React error:
          "Encountered a script tag while rendering React component." (Bug B fix) */}

      {/* LazyMotion provider — async motion features (out of First Load JS; D-25) */}
      <MotionProvider>
      {/* Scroll progress bar — fixed top, z-60, pointer-events:none */}
      <ScrollProgress />

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

      {/* ⌘K / Ctrl+K command palette — LAZY client island (deferred chunk) */}
      <CommandPaletteLazy
        username={username}
        items={cmdItems}
        resumeUrl={cmdResumeUrl}
        email={cmdEmail}
        socials={cmdSocials}
      />
      </MotionProvider>
    </div>
  );
}
