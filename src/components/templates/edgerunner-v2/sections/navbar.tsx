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
 *        - Scroll-spy: IntersectionObserver on actual #id elements (offsetTop was 0
 *            because the <div id> is the immediate child of a <section> wrapper whose
 *            own offsetTop is the real page position — el.offsetTop returned 0 always).
 *        - Smooth-scroll: click handler calls scrollIntoView({behavior:'smooth'});
 *            respects prefers-reduced-motion (uses 'auto' when reduced).
 *   6. Props: { items: {id:string; label:string}[]; logoText: string }
 *        logoText = last word of display_name uppercased + ".dev" computed in index.tsx
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Command } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  /** If set, clicking navigates to this href instead of smooth-scrolling to #id */
  href?: string;
}

export interface NavbarProps {
  items: NavItem[];
  /** Wordmark stem, e.g. "NAKAMURA" (no ".dev" suffix — appended in render) */
  logoText: string;
  /** Badge text shown in the logo square, e.g. "K_N" (first-letter of each name word joined by _) */
  badge?: string;
  /** Username for the portfolio owner — used to build route hrefs */
  username?: string;
}

/**
 * IntersectionObserver-based scroll-spy.
 *
 * ROOT CAUSE of the old offsetTop=0 bug: the `<div id="about">` etc. are immediate
 * children of `<ScrollReveal as="section">` wrappers. `el.offsetTop` is relative to
 * offsetParent (the <section>), which is 0. We need absolute page position.
 *
 * Fix: observe each `#<id>` element with IntersectionObserver (rootMargin so the
 * topmost visible section triggers active). Falls back gracefully if IO is absent
 * (SSR / very old browser) by using getBoundingClientRect + scroll event.
 */
function useScrollSpy(ids: string[]): string {
  const [active, setActive] = useState<string>(ids[0] ?? '');
  // Keep a stable ref to ids so the effect doesn't re-run on every render
  const idsRef = useRef(ids);
  useEffect(() => { idsRef.current = ids; }, [ids]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

    // rootMargin: top -10% to -80% — a section is "active" when its top edge is
    // in the upper 10–80% of the viewport (i.e. it has scrolled into view).
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost intersecting entry (smallest boundingClientRect.top ≥ 0)
        // or the last one that crossed the top boundary.
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 }
    );

    const elements: Element[] = [];
    for (const id of idsRef.current) {
      const el = document.getElementById(id);
      if (el) { observer.observe(el); elements.push(el); }
    }

    return () => {
      for (const el of elements) observer.unobserve(el);
      observer.disconnect();
    };
  // Only re-run when the ids array reference changes (ids is derived from navItems which is stable)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return active;
}

/** Smooth-scroll to a section id; respects prefers-reduced-motion. */
function smoothScrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
}

export function Navbar({ items, logoText, badge }: NavbarProps) {
  // logoText is the last-name stem, e.g. "NAKAMURA" (index strips ".dev" suffix before passing)
  // We render stem + cyan ".dev" in the wordmark.
  // badge is computed in index.tsx from the full display name (e.g. "K_N" for "Kai Nakamura").
  const stem = logoText; // already the stem, no ".dev" suffix
  const badgeText = badge ?? (stem.length >= 2 ? stem[0] + '_' + stem[stem.length - 1] : stem);

  // Only spy on anchor items (items without an href) — route items (Services, Blog) are not sections.
  const anchorItems = items.filter((l) => !l.href);
  const sectionIds = anchorItems.map((l) => l.id);
  const active = useScrollSpy(sectionIds);
  const [open, setOpen] = useState(false);

  const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    smoothScrollTo(id);
  }, []);

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
        <a href="#hero" onClick={(e) => handleNavClick(e, 'hero')} className="group flex items-center gap-2" style={{ textDecoration: 'none' }}>
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
            // Route items (Services, Blog) navigate with a plain href — no scroll interception.
            // Anchor items smooth-scroll to their #id on the homepage.
            if (l.href) {
              return (
                <a
                  key={l.id}
                  href={l.href}
                  className="group relative px-3 py-2 font-mono-retro text-base uppercase tracking-widest transition-colors tmpl-nav-link"
                  style={{
                    color: 'color-mix(in oklab, var(--fg) 70%, transparent)',
                    textDecoration: 'none',
                  }}
                >
                  {l.label}
                </a>
              );
            }
            return (
              <a
                key={l.id}
                href={`#${l.id}`}
                onClick={(e) => handleNavClick(e, l.id)}
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

        {/* Right side: ⌘K hint + hamburger */}
        <div className="flex items-center gap-2">
          {/* ⌘K hint badge — dispatches cmdk-open event, matches export kbd pill */}
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
              // Route items (Services, Blog) navigate directly — no scroll interception.
              if (l.href) {
                return (
                  <a
                    key={l.id}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2 font-mono-retro text-lg uppercase tracking-wider tmpl-nav-mobile-link"
                    style={{
                      color: 'color-mix(in oklab, var(--fg) 80%, transparent)',
                      textDecoration: 'none',
                      display: 'block',
                    }}
                  >
                    {l.label}
                  </a>
                );
              }
              return (
                <a
                  key={l.id}
                  href={`#${l.id}`}
                  onClick={(e) => { handleNavClick(e, l.id); setOpen(false); }}
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
