/**
 * WR-05 — the render-gate / operator-script SLUG ANCHOR.
 *
 * Several Phase-10 surfaces hardcode the corpus slug set instead of iterating the registry,
 * because their runners cannot import `registry.ts` at collection/run time:
 *   - the Playwright render specs (`template-a11y.spec.ts`, `template-visual-parity.spec.ts`)
 *     and the tsx preview command (`scripts/preview-template.ts`) read the SHARED
 *     `e2e/helpers/slugs.ts` constant (`TEMPLATE_SLUGS`);
 *   - the plain-node `scripts/generate-template-thumbnails.mjs` keeps an in-file `SLUGS`
 *     literal (it cannot import a `.ts` module under bare `node`).
 *
 * The phase's stated invariant is "a Phase-11 ingested template inherits the gate by registry
 * membership". For these hardcoded surfaces that is NOT automatic — so this Vitest anchor (which
 * CAN import `registry.ts`) is the loud failure that forces the slug to be added everywhere when
 * a Phase-11 template lands. It is the SAME anchor pattern the negative controls use: a gate that
 * silently skips a freshly-ingested (untrusted) template is the exact gap WR-05 closes.
 *
 * NOTE the unit gates (`security-grep`, `registry-consistency`, isolation, token-conformance)
 * already iterate `Object.keys(templateRegistry)` directly and need NO anchor — they cover a new
 * slug by construction. This anchor exists only for the runners that physically cannot.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { templateRegistry } from '@/components/templates/registry';
import { TEMPLATE_SLUGS } from '../../../e2e/helpers/slugs';

const REGISTERED = [...Object.keys(templateRegistry)].sort();

describe('WR-05 — hardcoded render-gate / script slug sets stay anchored to the registry', () => {
  it('the shared TEMPLATE_SLUGS constant equals Object.keys(templateRegistry)', () => {
    expect(
      [...TEMPLATE_SLUGS].sort(),
      'e2e/helpers/slugs.ts TEMPLATE_SLUGS has drifted from templateRegistry — the a11y/parity ' +
        'render specs and the preview command would silently skip (or 404) a registered template. ' +
        'Add the new Phase-11 slug to e2e/helpers/slugs.ts alongside its registry.ts line.',
    ).toEqual(REGISTERED);
  });

  it("the generate-template-thumbnails.mjs in-file SLUGS literal equals Object.keys(templateRegistry)", () => {
    // The `.mjs` runs under bare `node` and cannot import the registry, so its literal is
    // read from SOURCE and compared. A Phase-11 template that forgets this line would ship
    // with no committed thumbnail asset.
    const src = readFileSync(path.resolve('scripts/generate-template-thumbnails.mjs'), 'utf8');
    const m = src.match(/const SLUGS\s*=\s*\[([^\]]*)\]/);
    expect(m, 'could not locate the `const SLUGS = [...]` literal in generate-template-thumbnails.mjs').not.toBeNull();
    const literalSlugs = (m![1].match(/['"]([^'"]+)['"]/g) ?? [])
      .map((q) => q.slice(1, -1))
      .sort();
    expect(
      literalSlugs,
      'scripts/generate-template-thumbnails.mjs SLUGS has drifted from templateRegistry — a ' +
        'Phase-11 template would ship with no committed thumbnail. Add the new slug to that ' +
        'literal alongside its registry.ts line.',
    ).toEqual(REGISTERED);
  });
});
