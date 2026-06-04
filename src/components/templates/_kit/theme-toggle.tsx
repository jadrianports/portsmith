'use client';

/**
 * Theme toggle island — the SHARED-KIT light/dark switch (D-01/D-03 — PIPE-01).
 * Synthesized from the two per-template analogs (`minimal`/`editorial`), which shared
 * this logic and differed on exactly 5 axes: root selector, default mode, positioning,
 * radius, background, and focus token. The kit keeps the LOGIC + the universal 44px
 * hit-area; ALL per-template VISUAL styling (position / radius / background / focus
 * ring) moves to a `.tmpl-theme-toggle` CSS hook each template's scoped `theme.css`
 * owns. So the island is chrome-free + slug-agnostic: it targets the generic
 * `[data-template-root]` attribute (TEMPLATE_ROOT_ATTR) instead of a `.tmpl-<slug>`
 * selector, and carries no token.
 *
 * Mechanics ("load both, switch via CSS" — D-16): both token sets already live in each
 * template's `theme.css` scoped to its root; this island only flips the
 * `data-template-theme` attribute on `[data-template-root]` and persists the choice to
 * `localStorage['portsmith-theme']`. It NEVER conditionally imports a stylesheet or
 * re-fetches. The pre-paint FOUC guard (`themeInitScript`, kit `theme-init.ts`, rendered
 * by each `index.tsx`) sets the initial attribute before this island hydrates, so there
 * is no flash; this island then handles clicks.
 *
 * Accessibility (UI-SPEC REQUIRED): the button is glyph-only, so it carries an explicit
 * `aria-label` reflecting the NEXT action — "Switch to light mode" when dark is active,
 * "Switch to dark mode" when light is active. The label updates with the mode. Focus is
 * the canonical `--ring` token, styled via `:focus-visible` in each `theme.css` (the
 * `.tmpl-theme-toggle:focus-visible` hook), matching the contact-field focus pattern —
 * never an accent fill.
 *
 * Only color variables swap between modes — fonts never change (next/font can't swap
 * families at runtime, and the design does not ask it to).
 */
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { THEME_STORAGE_KEY, TEMPLATE_ROOT_ATTR, type TemplateThemeMode } from './theme-init';

/** Read the attribute the FOUC guard already set, so hydration matches first paint. */
function readActiveMode(fallback: TemplateThemeMode): TemplateThemeMode {
  if (typeof document === 'undefined') return fallback;
  const root = document.querySelector(`[${TEMPLATE_ROOT_ATTR}]`);
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
    const root = document.querySelector<HTMLElement>(`[${TEMPLATE_ROOT_ATTR}]`);
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
      // Per-template styling hook: position / radius / background / :focus-visible ring
      // all live in each template's scoped `theme.css` (`.tmpl-<slug> .tmpl-theme-toggle`).
      // The island carries only the universal hit-area + glyph centering below.
      className="tmpl-theme-toggle"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        // >=44px hit area (UI-SPEC touch-target rule) even though the glyph is smaller.
        width: '44px',
        height: '44px',
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--fg)',
        cursor: 'pointer',
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
