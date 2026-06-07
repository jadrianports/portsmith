'use client';
/**
 * Sticky pill Navbar for edgerunner-v2 — bar-for-bar transcription of
 * lovable-exports/synthwave-founder/src/components/layout/Navbar.tsx
 *
 * TRANSCRIPTION RULES APPLIED:
 *   1. Layout/sizing/typography Tailwind classes COPIED VERBATIM from export JSX.
 *   2. Color classes → inline style with scoped var(--token):
 *        border-neon-purple/30 → color-mix(in oklab, var(--neon-purple) 30%, transparent)
 *        bg-background/60     → color-mix(in srgb, var(--bg) 60%, transparent)
 *        bg-background/90     → color-mix(in srgb, var(--bg) 90%, transparent)
 *        bg-background/40     → color-mix(in srgb, var(--bg) 40%, transparent)
 *        text-foreground/70   → color-mix(in oklab, var(--fg) 70%, transparent)
 *        text-foreground/80   → color-mix(in oklab, var(--fg) 80%, transparent)
 *        text-foreground/90   → color-mix(in oklab, var(--fg) 90%, transparent)
 *        border-neon-pink/60  → color-mix(in oklab, var(--neon-pink) 60%, transparent)
 *        border-neon-cyan/40  → color-mix(in oklab, var(--neon-cyan) 40%, transparent)
 *        bg-neon-pink/10      → color-mix(in srgb, var(--neon-pink) 10%, transparent)
 *        bg-neon-cyan/10      → color-mix(in srgb, var(--neon-cyan) 10%, transparent)
 *        hover:text-neon-cyan → .tmpl-nav-link-hover (theme.css)
 *        hover:text-neon-pink → .tmpl-nav-mobile-link-hover (theme.css)
 *   3. Custom classes (shadow-neon-purple, bg-gradient-neon, shadow-neon-pink,
 *        font-display, font-mono-retro, text-glow-pink, text-neon-pink, text-neon-cyan)
 *        KEPT AS-IS (scoped in theme.css).
 *   4. framer-motion → motion/react. All motion values VERBATIM.
 *   5. CHANGES FROM EXPORT:
 *        - TanStack Router Link → plain <a href="#{id}"> (single-page, no router)
 *        - useRouterState + pathname → always onHome=true (single-page scroll app)
 *        - ⌘K / CommandPalette <kbd> DROPPED (cut feature)
 *        - Blog link DROPPED (deferred)
 *        - Services and other section links come from `items` prop (not hardcoded)
 *        - Logo wordmark derived from `logoText` prop
 *        - Scroll-spy: useScrollSpy hook inlined (IntersectionObserver on section offsetTop)
 *   6. Props: { items: {id:string; label:string}[]; logoText: string }
 *        logoText = last word of display_name uppercased + ".dev" computed in index.tsx
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
}

export interface NavbarProps {
  items: NavItem[];
  /** Wordmark stem, e.g. "NAKAMURA" (no ".dev" suffix — appended in render) */
  logoText: string;
  /** Badge text shown in the logo square, e.g. "K_N" (first-letter of each name word joined by _) */
  badge?: string;
}

/** Inline scroll-spy: mirrors the export's useScrollSpy hook (ids, offset=120) */
function useScrollSpy(ids: string[], offset = 120): string {
  const [active, setActive] = useState<string>(ids[0] ?? '');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      const scrollPos = window.scrollY + offset;
      let current = ids[0] ?? '';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= scrollPos) current = id;
      }
      setActive(current);
    };
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [ids, offset]);

  return active;
}

export function Navbar({ items, logoText, badge }: NavbarProps) {
  // logoText is the last-name stem, e.g. "NAKAMURA" (index strips ".dev" suffix before passing)
  // We render stem + cyan ".dev" in the wordmark.
  // badge is computed in index.tsx from the full display name (e.g. "K_N" for "Kai Nakamura").
  const stem = logoText; // already the stem, no ".dev" suffix
  const badgeText = badge ?? (stem.length >= 2 ? stem[0] + '_' + stem[stem.length - 1] : stem);

  const sectionIds = items.map((l) => l.id);
  const active = useScrollSpy(sectionIds);
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
        {/* Logo — VERBATIM from export */}
        <a href="#hero" className="group flex items-center gap-2" style={{ textDecoration: 'none' }}>
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

        {/* Desktop nav — VERBATIM from export */}
        <nav className="hidden items-center gap-1 lg:flex">
          {items.map((l) => {
            const isActive = active === l.id;
            return (
              <a
                key={l.id}
                href={`#${l.id}`}
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
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-2 -bottom-0.5 h-px bg-gradient-neon shadow-neon-pink"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Hamburger — VERBATIM from export (⌘K dropped) */}
        <div className="flex items-center gap-2">
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

      {/* Mobile dropdown — VERBATIM from export */}
      <AnimatePresence>
        {open && (
          <motion.nav
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
              const isActive = active === l.id;
              return (
                <a
                  key={l.id}
                  href={`#${l.id}`}
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
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
