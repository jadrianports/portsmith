/**
 * PIPE-04 (raw-input security scan) — drives `scripts/ingest-scan.ts` (Phase-11 Plan 02;
 * D-P11-06 two-tier / D-13/14). The input-side twin of `security-grep.test.ts`.
 *
 * `ingest:scan` is a near-clone of `gate:security`: the SAME TS-AST-for-structure +
 * regex-for-text hybrid, the SAME `scripts/template-allowlist.ts` source of truth — but it
 * (1) walks the WHOLE raw export (incl. `.js/.jsx`/`index.html`/`package.json`), (2) emits
 * a TWO-TIER `must-strip | flag` report, and (3) parses `package.json` deps.
 *
 * Both polarities (the prove-RED + prove-green idiom):
 *   RED-on-dirty — `scanIngest(DIRTY)` returns >= 1 finding per exercised must-strip rule;
 *     the Set of rule ids includes 'hardcoded-secret', 'danger-html', 'external-origin'; the
 *     must-strip rule count is >= 3; the 'unknown-dependency' FLAG is present and NAMES the
 *     dep (`react-quill`). A scanner that has only ever passed is untrusted.
 *   green-on-clean — `scanIngest(CLEAN).findings.filter(f => f.tier === 'must-strip')` is
 *     empty (flags on unknown deps are PERMITTED in clean; only must-strip must be zero).
 *   exit-code contract — a finding with tier 'must-strip' => a non-zero would-be exit code;
 *     flags alone => exit code 0 (the input scan never blocks on an unknown dep — D-P11-06).
 *     We test the pure classifier, NOT `process.exit`.
 */
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { scanIngest, type IngestFinding } from '../../../scripts/ingest-scan';

const DIRTY = path.resolve('tests/fixtures/dirty-export');
const CLEAN = path.resolve('tests/fixtures/clean-export');

/** The would-be CLI exit code: non-zero IFF any finding is tier 'must-strip' (flags never block). */
function wouldExitNonZero(findings: IngestFinding[]): boolean {
  return findings.some((f) => f.tier === 'must-strip');
}

describe('PIPE-04 ingest:scan — the raw-input two-tier security scan (ingest-scan.ts)', () => {
  describe('RED-on-dirty: the dirty export trips >= 3 distinct must-strip rules + the dep FLAG', () => {
    const { findings } = scanIngest(DIRTY);
    const mustStrip = findings.filter((f) => f.tier === 'must-strip');
    const mustStripRules = new Set(mustStrip.map((f) => f.rule));
    const flags = findings.filter((f) => f.tier === 'flag');
    const detailFor = (rule: string): string =>
      findings.find((f) => f.rule === rule)?.detail ?? '(no finding found)';

    it('REJECTS the inlined `VITE_*` secret reference (hardcoded-secret, must-strip)', () => {
      expect(
        mustStripRules.has('hardcoded-secret'),
        `the dirty fixture's \`const KEY = 'VITE_SUPABASE_ANON_KEY'\` must be a must-strip ` +
          `hardcoded-secret — got: ${detailFor('hardcoded-secret')}`,
      ).toBe(true);
    });

    it('REJECTS the non-sanctioned `dangerouslySetInnerHTML` (danger-html, must-strip)', () => {
      expect(
        mustStripRules.has('danger-html'),
        `the dirty fixture's free-form \`__html\` must be a must-strip danger-html (no ` +
          `sanctioned producer exists on the raw input side) — got: ${detailFor('danger-html')}`,
      ).toBe(true);
    });

    it('REJECTS the external `<img src>` origin (external-origin, must-strip)', () => {
      expect(
        mustStripRules.has('external-origin'),
        `the dirty fixture's \`<img src="https://cdn.evil.example/x.png">\` must be a ` +
          `must-strip external-origin — got: ${detailFor('external-origin')}`,
      ).toBe(true);
      expect(detailFor('external-origin')).toMatch(/evil\.example/);
    });

    it('FLAGS the unvetted package.json dependency and NAMES it (unknown-dependency, flag)', () => {
      const depFlag = flags.find((f) => f.rule === 'unknown-dependency');
      expect(
        depFlag,
        `the dirty fixture's \`react-quill\` (absent from ALLOWED_IMPORT_SPECIFIERS) must be ` +
          `an unknown-dependency FLAG (tier 'flag', NEVER must-strip — D-P11-06) — got flags: ` +
          `${flags.map((f) => `[${f.rule}] ${f.detail}`).join('; ') || '(none)'}`,
      ).toBeDefined();
      expect(depFlag?.tier).toBe('flag');
      expect(
        flags.some((f) => f.rule === 'unknown-dependency' && /react-quill/.test(f.detail)),
        `the unknown-dependency flag detail must NAME the dep (react-quill) — got: ` +
          `${flags.filter((f) => f.rule === 'unknown-dependency').map((f) => f.detail).join('; ')}`,
      ).toBe(true);
    });

    it('trips at least 3 distinct must-strip rules (a single weakening cannot pass it)', () => {
      expect(
        mustStripRules.size,
        `the dirty fixture tripped ${mustStripRules.size} distinct must-strip rule(s) ` +
          `(${[...mustStripRules].join(', ')}); expected >= 3 (hardcoded-secret, danger-html, ` +
          'external-origin at minimum).',
      ).toBeGreaterThanOrEqual(3);
    });
  });

  describe('green-on-clean: the clean export trips zero must-strip findings (Pitfall-1 canary)', () => {
    const { findings } = scanIngest(CLEAN);
    const mustStrip = findings.filter((f) => f.tier === 'must-strip');

    it('returns ZERO must-strip findings on the clean fixture', () => {
      expect(
        mustStrip,
        `the input scan FALSE-FIRED a must-strip on the clean fixture ` +
          `(${mustStrip.map((f) => `[${f.rule}] ${f.detail}`).join('; ')}). A must-strip here is a ` +
          'false positive on legal constructs (onClick JSX / relative import / Tailwind class), ' +
          'NOT a real violation — Pitfall 1.',
      ).toHaveLength(0);
    });

    it('its package.json deps are all allowlisted (zero unknown-dependency flags)', () => {
      const depFlags = findings.filter((f) => f.rule === 'unknown-dependency');
      expect(
        depFlags,
        `the clean fixture's deps (react/react-dom/lucide-react) are all allowlisted, so the ` +
          `dep parse must produce no unknown-dependency flag — got: ` +
          `${depFlags.map((f) => f.detail).join('; ')}`,
      ).toHaveLength(0);
    });
  });

  describe('exit-code contract: must-strip blocks, flags alone never block (D-P11-06)', () => {
    it('a dirty export (has must-strip) => the would-be exit code is non-zero', () => {
      const { findings } = scanIngest(DIRTY);
      expect(wouldExitNonZero(findings)).toBe(true);
    });

    it('a clean export (zero must-strip) => the would-be exit code is zero', () => {
      const { findings } = scanIngest(CLEAN);
      expect(wouldExitNonZero(findings)).toBe(false);
    });

    it('a flag-only finding set => exit code zero (an unknown-dep alone never blocks)', () => {
      const flagOnly: IngestFinding[] = [
        { tier: 'flag', rule: 'unknown-dependency', file: 'package.json', detail: 'react-quill' },
      ];
      expect(wouldExitNonZero(flagOnly)).toBe(false);
    });
  });
});
