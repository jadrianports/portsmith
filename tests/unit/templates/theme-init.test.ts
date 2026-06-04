// PIPE-01 — the shared-kit FOUC guard contract (09-01-T1). Wave-0 VALIDATION test.
//
// Proves the extracted `themeInitScript` (kit `theme-init.ts`) preserves the three
// load-bearing invisible contracts after the kit move:
//   (a) it targets the GENERIC `[data-template-root]` attribute, NOT a `.tmpl-<slug>`
//       literal (D-02 slug-agnostic);
//   (b) it COERCES the embedded default to the `light|dark` enum — XSS-safe (T-09-01);
//       `defaultMode` stays a PARAMETER, so `'light'` passes through (Pitfall 2) and any
//       unknown value falls back to `'dark'`;
//   (c) it uses the stable `THEME_STORAGE_KEY === 'portsmith-theme'` so visitors' persisted
//       theme survives the move.
//
// Pattern mirrors tests/unit/templates/mismatch.test.ts: plain describe/it, import the
// pure fn from the kit barrel, inline assertions, NO vi.mock, NO Supabase.
import { describe, expect, it } from 'vitest';

import {
  themeInitScript,
  THEME_STORAGE_KEY,
  TEMPLATE_ROOT_ATTR,
} from '@/components/templates/_kit';

describe('PIPE-01 — themeInitScript FOUC guard (shared kit)', () => {
  it('targets the generic [data-template-root] attribute (D-02 slug-agnostic)', () => {
    const script = themeInitScript('dark');
    expect(TEMPLATE_ROOT_ATTR).toBe('data-template-root');
    expect(script).toContain('[data-template-root]');
    // No slug literal may leak into the kit-emitted script.
    expect(script).not.toContain('.tmpl-minimal');
    expect(script).not.toContain('.tmpl-editorial');
  });

  it('embeds light when passed light (editorial passes LIGHT through — Pitfall 2)', () => {
    expect(themeInitScript('light')).toContain("var d='light'");
  });

  it('coerces every non-light value to dark (XSS-safe enum — T-09-01)', () => {
    // minimal passes 'dark'; the unknown/undefined cases must coerce to the product default.
    expect(themeInitScript('dark')).toContain("var d='dark'");
    expect(themeInitScript('bogus')).toContain("var d='dark'");
    expect(themeInitScript(undefined)).toContain("var d='dark'");
    expect(themeInitScript(null)).toContain("var d='dark'");
    // No free-form value can ever reach the embedded literal.
    expect(themeInitScript("'); alert(1); //")).not.toContain('alert');
  });

  it('uses the stable THEME_STORAGE_KEY so persisted choices survive the move', () => {
    expect(THEME_STORAGE_KEY).toBe('portsmith-theme');
    expect(themeInitScript('dark')).toContain("localStorage.getItem('portsmith-theme')");
  });
});
