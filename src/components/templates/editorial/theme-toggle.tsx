'use client';

/**
 * Theme toggle island — the Newsprint template's light/dark switch (D-P7-06;
 * 07-UI-SPEC A.6 §"Mechanics"). One of only TWO client islands the `editorial`
 * template ships (the tree is otherwise a Server Component — A.8 / TMPL-04 budget).
 *
 * RE-IMPLEMENTED SCOPED, NOT imported from `minimal` (SHARED-5): `minimal`'s islands
 * carry `minimal`'s tokens + `themeInitScript` + `.tmpl-minimal` selector. This is
 * the same logic, scoped to `.tmpl-editorial` and importing the EDITORIAL fonts
 * module (`./fonts`).
 *
 * Mechanics ("load both, switch via CSS"): both token sets already live in theme.css
 * scoped to `.tmpl-editorial`; this island only flips the `data-template-theme`
 * attribute on that root and persists the choice to `localStorage['portsmith-theme']`.
 * It NEVER conditionally imports a stylesheet or re-fetches. The pre-paint FOUC guard
 * (themeInitScript in fonts.ts, rendered by index.tsx) sets the initial attribute
 * before this island hydrates, so there is no flash; this island then handles clicks.
 *
 * Accessibility (A.6 REQUIRED): the button is glyph-only, so it carries an explicit
 * `aria-label` reflecting the NEXT action — "Switch to dark mode" when light is
 * active, "Switch to light mode" when dark is active. The label updates with the mode.
 * Focus uses the VERMILION ring (`--ring`/`--accent`), never an accent fill; a thin
 * ink border at rest (Swiss). >=44px hit area.
 *
 * Only color variables swap between modes — fonts never change.
 */
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { THEME_STORAGE_KEY, type TemplateThemeMode } from './fonts';

/** Read the attribute the FOUC guard already set, so hydration matches first paint. */
function readActiveMode(fallback: TemplateThemeMode): TemplateThemeMode {
  if (typeof document === 'undefined') return fallback;
  const root = document.querySelector('.tmpl-editorial');
  const attr = root?.getAttribute('data-template-theme');
  return attr === 'light' || attr === 'dark' ? attr : fallback;
}

export function ThemeToggle({ defaultMode = 'light' }: { defaultMode?: TemplateThemeMode }) {
  // Start from the server default (LIGHT for editorial — D-P7-06) for a stable first
  // render, then sync to whatever the pre-paint FOUC guard actually resolved
  // (localStorage / prefers-color-scheme).
  const [mode, setMode] = useState<TemplateThemeMode>(defaultMode);

  useEffect(() => {
    setMode(readActiveMode(defaultMode));
  }, [defaultMode]);

  function toggle() {
    const next: TemplateThemeMode = mode === 'dark' ? 'light' : 'dark';
    const root = document.querySelector<HTMLElement>('.tmpl-editorial');
    if (root) root.dataset.templateTheme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode / storage disabled — the in-session swap still works.
    }
    setMode(next);
  }

  const isDark = mode === 'dark';
  // aria-label reflects the NEXT action (the mode you switch TO).
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 50,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        // >=44px hit area (A.2 touch-target rule) even though the glyph is smaller.
        width: '44px',
        height: '44px',
        // Near-square (editorial), not pill — the Swiss radius scale.
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--fg)',
        cursor: 'pointer',
      }}
      // Vermilion focus ring (never an accent fill); kept minimal as this is a leaf island.
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid var(--ring)';
        e.currentTarget.style.outlineOffset = '2px';
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none';
      }}
    >
      {isDark ? (
        <Sun aria-hidden="true" width={18} height={18} />
      ) : (
        <Moon aria-hidden="true" width={18} height={18} />
      )}
    </button>
  );
}
