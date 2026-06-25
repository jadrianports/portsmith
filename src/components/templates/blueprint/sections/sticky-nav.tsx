'use client';

/**
 * StickyNav — a FAITHFUL clone of the export's `StickyNav.tsx`: a fixed top bar with a mono
 * `/handle` mark on the left and mono section anchors on the right, the active section tracked
 * via IntersectionObserver (accent highlight) and a backdrop/hairline that fades in once
 * scrolled. The ONE client island this template adds beyond the kit `ScrollReveal` (kept per
 * the 1:1 faithful-clone directive — the export's nav is a signature instrument element).
 *
 * SLUG/TOKEN-FREE in spirit: it reads the scoped `var(--token)` values (inherited from the
 * `.tmpl-blueprint` root it renders under) via inline styles; it ships no chrome token and no
 * `.tmpl-<slug>` literal of its own.
 */
import { useEffect, useState } from 'react';

export interface NavSection {
  id: string;
  label: string;
}

export function StickyNav({ sections, brand }: { sections: NavSection[]; brand: string }) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? '');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!els.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: '-40% 0px -55% 0px', threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [sections]);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-colors"
      style={
        scrolled
          ? {
              backgroundColor: 'color-mix(in srgb, var(--bg) 85%, transparent)',
              backdropFilter: 'blur(8px)',
              borderBottom: '1px solid var(--border)',
            }
          : { backgroundColor: 'transparent' }
      }
    >
      <nav aria-label="Primary" className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-6 py-3">
        <a
          href="#hero"
          className="bp-link bp-mono text-xs tracking-[0.2em] uppercase"
          style={{ color: 'var(--fg)' }}
        >
          <span style={{ color: 'var(--accent-text)' }}>/</span>
          {brand}
        </a>
        <ul className="bp-mono hidden md:flex items-center gap-1 text-[11px] tracking-wider uppercase">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="px-2.5 py-1.5 rounded-sm transition-colors"
                style={{ color: active === s.id ? 'var(--accent-text)' : 'var(--muted-fg)' }}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
