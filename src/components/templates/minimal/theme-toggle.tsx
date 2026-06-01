'use client';

/**
 * Theme toggle island — the founder template's light/dark switch (D-16; UI-SPEC
 * §"Theming — Toggle"). One of only TWO client islands the `minimal` template
 * ships (the template tree is otherwise a Server Component — TMPL-04 budget).
 *
 * Mechanics ("load both, switch via CSS" — D-16): both token sets already live in
 * theme.css scoped to `.tmpl-minimal`; this island only flips the
 * `data-template-theme` attribute on that root and persists the choice to
 * `localStorage['portsmith-theme']`. It NEVER conditionally imports a stylesheet
 * or re-fetches. The pre-paint FOUC guard (themeInitScript in fonts.ts, rendered
 * by 03-04's index.tsx) sets the initial attribute before this island hydrates,
 * so there is no flash; this island then handles clicks.
 *
 * Accessibility (UI-SPEC REQUIRED): the button is glyph-only, so it carries an
 * explicit `aria-label` reflecting the NEXT action — "Switch to light mode" when
 * dark is active, "Switch to dark mode" when light is active. The label updates
 * with the mode. Focus uses the CYAN ring (`--accent-cyan`), never an accent fill.
 *
 * Only color variables swap between modes — fonts never change (next/font can't
 * swap families at runtime, and the design does not ask it to).
 */
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { THEME_STORAGE_KEY, type TemplateThemeMode } from './fonts';

/** Read the attribute the FOUC guard already set, so hydration matches first paint. */
function readActiveMode(fallback: TemplateThemeMode): TemplateThemeMode {
  if (typeof document === 'undefined') return fallback;
  const root = document.querySelector('.tmpl-minimal');
  const attr = root?.getAttribute('data-template-theme');
  return attr === 'light' || attr === 'dark' ? attr : fallback;
}

export function ThemeToggle({ defaultMode = 'dark' }: { defaultMode?: TemplateThemeMode }) {
  // Start from the server default for a stable first render, then sync to whatever
  // the pre-paint FOUC guard actually resolved (localStorage / prefers-color-scheme).
  const [mode, setMode] = useState<TemplateThemeMode>(defaultMode);

  useEffect(() => {
    setMode(readActiveMode(defaultMode));
  }, [defaultMode]);

  function toggle() {
    const next: TemplateThemeMode = mode === 'dark' ? 'light' : 'dark';
    const root = document.querySelector<HTMLElement>('.tmpl-minimal');
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
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        // >=44px hit area (UI-SPEC touch-target rule) even though the glyph is smaller.
        width: '44px',
        height: '44px',
        borderRadius: 'var(--radius-full)',
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--fg)',
        cursor: 'pointer',
      }}
      // Cyan focus ring (never an accent fill); class drives :focus-visible in CSS-less
      // inline context via the outline below — kept minimal as this is a leaf island.
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid var(--accent-cyan)';
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
