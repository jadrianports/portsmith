'use client';
/**
 * Sub-page Navbar for edgerunner-v2 — used on /services, /blog, etc.
 *
 * Identical visual treatment to `sections/navbar.tsx` but:
 *   - Uses explicit `href` per NavItem instead of `#id` anchors (links navigate
 *     back to /${username}#section or to sub-pages like /services, /blog).
 *   - No scroll-spy — active item is set by the `activeNav` prop instead.
 *   - Logo href is passed as `logoHref` (navigates back to `/${username}`).
 *
 * TRANSCRIPTION RULES: same as navbar.tsx — color classes → inline style var(--token),
 * custom classes kept, framer-motion → motion/react.
 */
import { useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { Menu, X, Command } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  href: string;
}

export interface NavbarSubpageProps {
  items: NavItem[];
  /** Wordmark stem, e.g. "NAKAMURA" (no ".dev" suffix) */
  logoText: string;
  /** Badge text, e.g. "K_N" */
  badge?: string;
  /** The id of the currently active nav item */
  activeNav: string;
  /** Where the logo links to (e.g. /${username}) */
  logoHref: string;
}

export function NavbarSubpage({
  items,
  logoText,
  badge,
  activeNav,
  logoHref,
}: NavbarSubpageProps) {
  const stem = logoText;
  const badgeText = badge ?? (stem.length >= 2 ? stem[0] + '_' + stem[stem.length - 1] : stem);
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Sticky pill — VERBATIM layout classes from export */}
      <div
        className="mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full border px-5 py-3 backdrop-blur-xl shadow-neon-purple"
        style={{
          borderColor: 'color-mix(in oklab, var(--neon-purple) 30%, transparent)',
          background: 'color-mix(in srgb, var(--bg) 60%, transparent)',
        }}
      >
        {/* Logo — links back to /${username} */}
        <a href={logoHref} className="group flex items-center gap-2" style={{ textDecoration: 'none' }}>
          <span
            className="grid h-9 w-9 place-items-center rounded-md font-display text-sm font-bold text-neon-pink text-glow-pink"
            aria-hidden="true"
            style={{
              border: '1px solid color-mix(in oklab, var(--neon-pink) 60%, transparent)',
            }}
          >
            {badgeText}
          </span>
          <span
            className="font-display text-sm font-semibold uppercase tracking-[0.25em]"
            style={{ color: 'color-mix(in oklab, var(--fg) 90%, transparent)' }}
          >
            {stem}<span className="text-neon-cyan">.dev</span>
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {items.map((l) => {
            const isActive = activeNav === l.id;
            return (
              <a
                key={l.id}
                href={l.href}
                className="group relative px-3 py-2 font-mono-retro text-base uppercase tracking-widest transition-colors tmpl-nav-link"
                style={{
                  color: isActive
                    ? 'var(--neon-pink)'
                    : 'color-mix(in oklab, var(--fg) 70%, transparent)',
                  textDecoration: 'none',
                  textShadow: isActive
                    ? '0 0 8px var(--neon-pink), 0 0 24px color-mix(in oklab, var(--neon-pink) 50%, transparent)'
                    : undefined,
                }}
              >
                {l.label}
                {isActive && (
                  <m.span
                    layoutId="nav-underline-sub"
                    className="absolute inset-x-2 -bottom-0.5 h-px bg-gradient-neon shadow-neon-pink"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Right side: ⌘K hint + hamburger */}
        <div className="flex items-center gap-2">
          {/* ⌘K hint badge — dispatches cmdk-open event */}
          <button
            type="button"
            aria-label="Open command palette"
            title="Open command palette"
            onClick={() => window.dispatchEvent(new CustomEvent('cmdk-open'))}
            className="hidden items-center gap-1.5 rounded-md font-mono-retro text-xs uppercase tracking-wider md:inline-flex"
            style={{
              border: '1px solid color-mix(in oklab, var(--neon-cyan) 40%, transparent)',
              background: 'color-mix(in srgb, var(--bg) 40%, transparent)',
              color: 'var(--neon-cyan)',
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            <Command className="h-3 w-3" aria-hidden="true" /> K
          </button>
          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden tmpl-nav-hamburger"
            style={{
              color: 'color-mix(in oklab, var(--fg) 80%, transparent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {open && (
          <m.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-auto mt-2 grid max-w-6xl gap-1 rounded-2xl border p-4 backdrop-blur-xl lg:hidden"
            style={{
              borderColor: 'color-mix(in oklab, var(--neon-purple) 30%, transparent)',
              background: 'color-mix(in srgb, var(--bg) 90%, transparent)',
            }}
          >
            {items.map((l) => {
              const isActive = activeNav === l.id;
              return (
                <a
                  key={l.id}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 font-mono-retro text-lg uppercase tracking-wider tmpl-nav-mobile-link"
                  style={{
                    background: isActive
                      ? 'color-mix(in srgb, var(--neon-pink) 10%, transparent)'
                      : undefined,
                    color: isActive
                      ? 'var(--neon-pink)'
                      : 'color-mix(in oklab, var(--fg) 80%, transparent)',
                    textDecoration: 'none',
                    display: 'block',
                  }}
                >
                  {l.label}
                </a>
              );
            })}
          </m.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
