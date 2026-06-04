/**
 * CICD-01 (security) — drives `scripts/gate-security.ts` (Phase-10 Plan 03; D-13/14).
 *
 * Both polarities (D-P10-02):
 *   GREEN-on-corpus — `scanTemplateSecurity` returns ZERO violations for the two LIVE
 *     templates (`minimal` + `editorial`). This is the Pitfall-1 CANARY: those folders
 *     legally contain `onClick={}` React JSX, `next/font/google` imports, and the TWO
 *     sanctioned `dangerouslySetInnerHTML` uses (themeInitScript + personLdScriptHtml). A
 *     RED here is a FALSE POSITIVE in the gate, not a real violation.
 *   RED-on-negative — the SAME pass returns a violation for EACH rule when run over the
 *     deliberately-broken negative fixture (`tests/fixtures/broken-template/`): a
 *     non-sanctioned `__html`, an external `<img src>` origin, and an unlisted
 *     (`canvas-confetti`) dependency. A gate that has only ever passed is untrusted.
 *
 * The security pass uses the TS compiler API (structural) — see `gate-security.ts`'s
 * `ts.createSourceFile`/`forEachChild` — so the legal-React constructs above do not
 * false-fire while their injection-shaped lookalikes in the fixture are rejected.
 */
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { scanTemplateSecurity } from '../../../scripts/gate-security';
import { templateRegistry } from '@/components/templates/registry';

// WR-05: derive the scanned corpus from EVERY registered slug rather than hardcoding
// MINIMAL/EDITORIAL. This Vitest runner CAN import `registry.ts` (Node ESM, no Playwright
// collection constraint), so a Phase-11 ingested (untrusted) template is security-scanned by
// `gate:security` AUTOMATICALLY on registry membership — closing the highest-risk coverage gap
// (a freshly-ingested template silently escaping the very gate that exists to vet it). The
// slug IS the folder name under `src/components/templates/`.
const REGISTERED_SLUGS = Object.keys(templateRegistry);
const CORPUS: ReadonlyArray<readonly [string, string]> = REGISTERED_SLUGS.map((slug) => [
  slug,
  path.resolve('src/components/templates', slug),
]);
const BROKEN = path.resolve('tests/fixtures/broken-template');

describe('CICD-01 security — the D-13/14 static pass (gate-security.ts)', () => {
  describe('GREEN-on-corpus: every registered template passes with zero violations (Pitfall 1 canary)', () => {
    it('has at least one registered slug to security-scan', () => {
      expect(
        REGISTERED_SLUGS.length,
        'templateRegistry is empty — no template folder would be security-scanned.',
      ).toBeGreaterThan(0);
    });

    it.each(CORPUS as Array<[string, string]>)('scanTemplateSecurity(%s) returns ZERO violations', (slug, folder) => {
      const { violations } = scanTemplateSecurity(folder);
      expect(
        violations,
        `the security pass FALSE-FIRED on the known-good '${slug}' template ` +
          `(${violations.map((v) => `[${v.rule}] ${v.detail}`).join('; ')}). A RED here is a ` +
          'false positive on legal React (onClick JSX / next/font/google / the sanctioned ' +
          'dangerouslySetInnerHTML), NOT a real violation — Pitfall 1.',
      ).toHaveLength(0);
    });
  });

  describe('RED-on-negative: the broken fixture trips a violation per rule (D-P10-02)', () => {
    const { violations } = scanTemplateSecurity(BROKEN);
    const rules = new Set(violations.map((v) => v.rule));
    const detailFor = (rule: string): string =>
      violations.find((v) => v.rule === rule)?.detail ?? '(no violation found)';

    it('REJECTS the non-sanctioned `dangerouslySetInnerHTML` (danger-html)', () => {
      expect(
        rules.has('danger-html'),
        `the negative fixture's free-form __html (\`<div dangerouslySetInnerHTML={{ __html: untrustedHtml }}/>\`) ` +
          `must be REJECTED as a non-sanctioned producer — got: ${detailFor('danger-html')}`,
      ).toBe(true);
      expect(detailFor('danger-html')).toMatch(/sanctioned/i);
    });

    it('REJECTS the external `<img src>` origin (external-origin)', () => {
      expect(
        rules.has('external-origin'),
        `the negative fixture's \`<img src="https://evil.example/tracker.png">\` must be REJECTED as ` +
          `an external (non-Supabase) origin — got: ${detailFor('external-origin')}`,
      ).toBe(true);
      expect(detailFor('external-origin')).toMatch(/evil\.example/);
    });

    it('REJECTS the unlisted dependency import (unknown-dependency)', () => {
      expect(
        rules.has('unknown-dependency'),
        `the negative fixture's \`import confetti from 'canvas-confetti'\` must be REJECTED as an ` +
          `unknown/unallowlisted dependency (D-P10-03) — got: ${detailFor('unknown-dependency')}`,
      ).toBe(true);
      expect(detailFor('unknown-dependency')).toMatch(/canvas-confetti/);
    });

    it('produces at least one violation per the three exercised rules', () => {
      // The fixture is the prove-RED corpus — it must trip MULTIPLE distinct rules so a
      // single accidental gate weakening cannot silently pass it.
      expect(
        rules.size,
        `the broken fixture tripped ${rules.size} distinct rule(s) (${[...rules].join(', ')}); ` +
          'expected at least the three exercised by index.tsx (danger-html, external-origin, unknown-dependency).',
      ).toBeGreaterThanOrEqual(3);
    });
  });
});
