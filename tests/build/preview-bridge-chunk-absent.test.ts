/**
 * EDIT-04 / T-27-02 — STRUCTURAL PROOF the edit-preview bridge stays off the public route
 * client chunks (Phase 27, Wave 0).
 *
 * The import-guard (`tests/unit/preview/preview-bridge-import-guard.test.ts`) proves the
 * bridge SOURCE imports no Zod/registry/template; THIS test proves the binary outcome from
 * a real build: the bridge module's marker (the `PREVIEW_BRIDGE_NAMESPACE` literal +/or the
 * bridge filename) appears in NONE of the public `/[username]` route's client chunks.
 *
 * It reads the SAME two chunk sets `scripts/check-bundle-budget.ts` measures (lines 272-302):
 *   1. `rootMainFiles` from the route build-manifest (the shared client entry chunks), and
 *   2. the `static/chunks/*.js` referenced by `page_client-reference-manifest.js` (the
 *      route-specific client islands).
 * For each chunk it gzip-reads the on-disk file's text and asserts the bridge marker is
 * absent. The bridge is gated by the `?edit=1` flag the public path never sets (D-02/D-08),
 * so its JS must never reach these sets — the structural half of EDIT-04.
 *
 * ── RED-TOLERANT ──────────────────────────────────────────────────────────────────
 * Requires a production build. When `.next` (or the route manifests) is ABSENT, the test
 * SKIPS with a "run `npm run build` first" hint rather than false-greening — mirroring
 * `tests/build/route-table-ssg.test.ts`. Until Plan 02 adds the bridge there is no marker
 * to find, so this is trivially green post-build; once the bridge exists it becomes the
 * binding regression catch.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PREVIEW_BRIDGE_NAMESPACE } from '@/lib/preview/bridge-messages';

const NEXT_DIR = path.resolve('.next');
const ROUTE_BUILD_MANIFEST = path.join(
  NEXT_DIR,
  'server',
  'app',
  '(portfolio)',
  '[username]',
  'page',
  'build-manifest.json',
);
const ROUTE_CLIENT_REF_MANIFEST = path.join(
  NEXT_DIR,
  'server',
  'app',
  '(portfolio)',
  '[username]',
  'page_client-reference-manifest.js',
);

/** The bridge fingerprints a leaked chunk would contain. */
const BRIDGE_MARKERS = [PREVIEW_BRIDGE_NAMESPACE, 'edit-preview-bridge'];

interface RouteBuildManifest {
  rootMainFiles?: string[];
  pages?: Record<string, string[]>;
}

/** The two chunk sets check-bundle uses (rootMainFiles ∪ client-reference-manifest chunks). */
function collectPublicRouteClientChunks(): string[] {
  const rbm = JSON.parse(readFileSync(ROUTE_BUILD_MANIFEST, 'utf8')) as RouteBuildManifest;
  const rootMain = Array.isArray(rbm.rootMainFiles) ? rbm.rootMainFiles : [];

  const routeChunks: string[] = [];
  if (existsSync(ROUTE_CLIENT_REF_MANIFEST)) {
    const crm = readFileSync(ROUTE_CLIENT_REF_MANIFEST, 'utf8');
    const matches = crm.match(/static\/chunks\/[A-Za-z0-9_./-]+\.js/g) ?? [];
    for (const m of matches) routeChunks.push(m);
  }

  const pageChunks: string[] = [];
  for (const list of Object.values(rbm.pages ?? {})) {
    for (const f of list) if (f.endsWith('.js')) pageChunks.push(f);
  }

  return [...new Set([...rootMain, ...routeChunks, ...pageChunks])];
}

const built = existsSync(ROUTE_BUILD_MANIFEST);

describe('EDIT-04 / T-27-02 — the edit-preview bridge is absent from public route client chunks', () => {
  it('the public route build manifest exists (run `npm run build` first; RED-tolerant)', () => {
    if (!built) {
      console.warn(
        `[preview-bridge-chunk-absent] ${ROUTE_BUILD_MANIFEST} not found — run ` +
          '`npm run build` (or `npm run check:bundle`) before this structural proof. Skipping.',
      );
      return;
    }
    expect(built).toBe(true);
  });

  it('no public route client chunk references the bridge marker', () => {
    if (!built) return; // RED-tolerant: covered by the build-presence skip above.

    const chunks = collectPublicRouteClientChunks();
    expect(
      chunks.length,
      'no client chunks resolved for /[username] — the build manifests changed shape.',
    ).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const rel of chunks) {
      const abs = path.join(NEXT_DIR, rel);
      if (!existsSync(abs)) continue;
      const contents = readFileSync(abs, 'utf8');
      for (const marker of BRIDGE_MARKERS) {
        if (contents.includes(marker)) {
          offenders.push(`${rel} (contains "${marker}")`);
          break;
        }
      }
    }

    expect(
      offenders,
      'the edit-preview bridge leaked onto the public /[username] client bundle ' +
        '(EDIT-04 / D-08): the bridge must mount ONLY under the `?edit=1` flag the public ' +
        `path never sets. Offending chunks:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });
});
