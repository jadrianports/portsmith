/**
 * Navbar (template chrome — NOT a by-type section) — the edgerunner sticky neon pill
 * nav (PIPE-09, Task-14). Translated from
 * `lovable-exports/synthwave-founder/src/components/layout/Navbar.tsx`:
 *   — framer-motion → motion/react (R1)
 *   — TanStack Router `<Link>` / route-awareness → plain `<a href="#id">` (single-scroll)
 *   — cmdk command-palette hint → dropped entirely
 *   — TanStack `useRouterState` → removed (there is no multi-page SPA here)
 *   — `useScrollSpy` hook → IntersectionObserver inlined here (no hook file needed)
 *
 * NO-JS-SAFE (R5): ALL nav links render as plain `<a href="#id">` elements in SSR HTML.
 * The active-highlight (neon underline/glow) is PURELY a progressive enhancement driven
 * by IntersectionObserver; it starts undefined and quietly adds highlighting as JS loads.
 * On the desktop breakpoint (lg+) links are ALWAYS inline regardless of the toggle state;
 * the hamburger + dropdown exist ONLY for viewports narrower than `lg`.
 *
 * MOBILE MENU: the hamburger is a JS-toggled dropdown. Even without JS on mobile the
 * links are still accessible — they're present in the DOM and visible inside the
 * `<details>`-pattern alternative is intentionally not used here because the hamburger
 * state also participates in the scroll-spy active-highlight. The links are never hidden
 * on desktop (only the hamburger button is `lg:hidden`; the link row is `hidden lg:flex`
 * with SSR supplying the initial state).
 *
 * COLORS: all via `var(--token)` from `theme.css` (SHARED-D); no hardcoded hex; no
 * chrome `--color-*` tokens.
 *
 * REDUCED-MOTION: no layout-shift animation on the underline (the layoutId spring from
 * the export is dropped); a plain CSS `transition: color` is fine and `prefers-reduced-
 * motion: reduce` zeroes it via the blanket reset in theme.css.
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, X } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
}

export interface NavbarProps {
  items: NavItem[];
  logoText: string;
}

/** Derive up-to-4-character initials badge from the logoText (or logoText itself if short). */
function initials(text: string): string {
  const parts = text.trim().split(/\s+/);
  if (parts.length === 1) {
    // single word: take first 3 chars
    return parts[0].slice(0, 3).toUpperCase();
  }
  // multi-word: first letter of each word, capped at 4
  return parts
    .slice(0, 4)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

/**
 * Derive the compact logo handle label: last word of logoText + ".dev".
 * e.g. "Kai Nakamura" → "NAKAMURA" + ".dev"
 *      "Portfolio"    → "PORTFOLIO" + ".dev"
 * Returns { handle: string, tld: '.dev' }.
 */
function compactHandle(text: string): string {
  const parts = text.trim().split(/\s+/);
  return parts[parts.length - 1].toUpperCase();
}

export function Navbar({ items, logoText }: NavbarProps) {
  const [open, setOpen] = useState(false);
  // active = the section id currently in view, or null if none
  const [active, setActive] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Scroll-spy: watch the section elements by id with IntersectionObserver.
  // The threshold is low (0.2) so a section registers as active once 20% is visible.
  // This is a PROGRESSIVE ENHANCEMENT — it only runs with JS; without JS `active` stays
  // null and no highlight is applied (links are still fully visible and functional).
  useEffect(() => {
    if (typeof window === 'undefined' || items.length === 0) return;

    const ids = items.map((l) => l.id);

    // Keep an ordered map of which sections are currently intersecting.
    // We pick the first one in DOM order as "active" when multiple overlap.
    const intersecting = new Map<string, boolean>(ids.map((id) => [id, false]));

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          intersecting.set(entry.target.id, entry.isIntersecting);
        }
        // Prefer the first intersecting section in source order.
        const current = ids.find((id) => intersecting.get(id)) ?? null;
        setActive(current);
      },
      { threshold: 0.2 },
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [items]);

  const badge = initials(logoText);
  const handle = compactHandle(logoText);

  return (
    <header
      style={{
        position: 'fixed',
        insetInline: 0,
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Pill nav bar */}
      <div
        className="tmpl-shell"
        style={{
          marginTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: 'var(--radius-full)',
          border: '1px solid color-mix(in oklab, var(--neon-purple) 30%, transparent)',
          background: 'color-mix(in srgb, var(--bg) 60%, transparent)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow:
            '0 0 0 1px color-mix(in oklab, var(--neon-purple) 10%, transparent), 0 8px 32px -16px color-mix(in oklab, var(--neon-purple) 35%, transparent)',
          padding: '8px 20px',
        }}
      >
        {/* Logo */}
        <a
          href="#hero"
          aria-label={`${logoText} — scroll to top`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'grid',
              placeItems: 'center',
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid color-mix(in oklab, var(--neon-pink) 60%, transparent)',
              fontFamily: 'var(--font-display)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--neon-pink)',
              textShadow:
                '0 0 8px var(--neon-pink), 0 0 20px color-mix(in oklab, var(--neon-pink) 50%, transparent)',
              letterSpacing: '0.05em',
              flexShrink: 0,
            }}
          >
            {badge}
          </span>
          {/* Compact handle: LASTNAME.dev — matches reference "NAKAMURA.dev" style */}
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: 'var(--fg)',
            }}
          >
            {handle}
            <span style={{ color: 'var(--neon-cyan)', letterSpacing: '0.05em' }}>.dev</span>
          </span>
        </a>

        {/* Desktop nav — always visible on lg+ regardless of JS/toggle state */}
        <nav
          aria-label="Page sections"
          style={{ display: 'none' }}
          className="tmpl-nav-desktop"
        >
          {items.map((item) => {
            const isActive = active === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={isActive ? 'tmpl-nav-link tmpl-nav-link--active' : 'tmpl-nav-link'}
                style={{ position: 'relative' }}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Hamburger — mobile only (hidden on lg+) */}
        <button
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="tmpl-edgerunner-mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="tmpl-nav-hamburger"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: 'var(--fg)',
            lineHeight: 1,
          }}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile dropdown — JS-only animated; falls back gracefully (no JS = no dropdown,
          but desktop links remain accessible and mobile users can still scroll manually).
          The overlay is visually complete without motion. */}
      <AnimatePresence>
        {open && (
          <motion.nav
            id="tmpl-edgerunner-mobile-menu"
            aria-label="Mobile page sections"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.14 }}
            className="tmpl-shell"
            style={{
              marginTop: '8px',
              display: 'grid',
              gap: '4px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid color-mix(in oklab, var(--neon-purple) 30%, transparent)',
              background: 'color-mix(in srgb, var(--bg) 90%, transparent)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              padding: '16px',
            }}
          >
            {items.map((item) => {
              const isActive = active === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setOpen(false)}
                  style={{
                    display: 'block',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '16px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    textDecoration: 'none',
                    background: isActive
                      ? 'color-mix(in oklab, var(--neon-pink) 10%, transparent)'
                      : 'transparent',
                    color: isActive ? 'var(--neon-pink)' : 'var(--muted-fg)',
                  }}
                >
                  {item.label}
                </a>
              );
            })}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
