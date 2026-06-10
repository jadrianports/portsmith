/**
 * RED (Wave 0, 13.2-01) — SC-1 / D-09: ZERO `dangerouslySetInnerHTML` in the
 * Markdown blog feature.
 *
 * This is the strongest, most literal form of success-criterion 1: the engine must
 * render Markdown INTO React via the existing prose primitives, never via an
 * HTML-string intermediate. `dangerouslySetInnerHTML` anywhere in the feature surface
 * is a stored-XSS hole and an automatic blocker.
 *
 * The gate reads every source file under the feature's directories with `node:fs`
 * and asserts NONE contains the literal `dangerouslySetInnerHTML`. Comment lines are
 * filtered out FIRST so a documenting comment (e.g. "// never use
 * dangerouslySetInnerHTML") cannot self-invalidate the gate — only real code counts.
 *
 * RED today because `src/lib/markdown/` does not exist yet. Once the render pipeline
 * is built (plan 13.2-02+), this becomes a real always-on guard over the feature.
 * If the dir is absent the directory walk yields an empty file list; we assert the
 * gate would still hold (and surface that the feature dir is not yet present so the
 * RED state is honest, not a vacuous pass).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..');

/** The feature surface that renders Markdown → React (the D-09 render path). */
const FEATURE_DIRS = [
  join(REPO_ROOT, 'src', 'lib', 'markdown'),
  join(REPO_ROOT, 'src', 'components', 'templates', 'edgerunner-v2', 'pages', 'blog'),
];

/** The three dedicated sub-route page files (also part of the feature surface). */
const FEATURE_FILES = [
  join(REPO_ROOT, 'src', 'app', '(portfolio)', '[username]', 'blog', 'page.tsx'),
  join(REPO_ROOT, 'src', 'app', '(portfolio)', '[username]', 'blog', '[slug]', 'page.tsx'),
  join(REPO_ROOT, 'src', 'app', '(portfolio)', '[username]', 'services', 'page.tsx'),
];

const SOURCE_EXT = /\.(ts|tsx|js|jsx)$/;
const DSIH = 'dangerouslySetInnerHTML';

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (SOURCE_EXT.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Strip line-comments and block-comment lines so a documenting comment mentioning the
 * forbidden token does not register as a code hit. (A simple line filter: skip lines
 * whose trimmed start is a block-comment body star, a line-comment slash-slash, or a
 * comment open/close fence.) This is the `grep -v '^#'`-equivalent the plan calls for,
 * adapted to TS comment syntax.
 */
function codeLines(src: string): string[] {
  return src.split(/\r?\n/).filter((line) => {
    const t = line.trimStart();
    return !(t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*/'));
  });
}

describe('SC-1 / D-09 — no dangerouslySetInnerHTML in the Markdown blog feature', () => {
  const files = [...FEATURE_DIRS.flatMap(walk), ...FEATURE_FILES.filter(existsSync)];

  it('the markdown render dir exists (RED until 13.2-02 builds src/lib/markdown/)', () => {
    // This assertion makes the RED state HONEST: until the render pipeline is built,
    // the dSIH walk over src/lib/markdown/ is vacuous. When this turns GREEN the gate
    // below becomes a real always-on guard.
    expect(existsSync(FEATURE_DIRS[0])).toBe(true);
  });

  it('no feature source file contains the dangerouslySetInnerHTML literal (in code)', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const hits = codeLines(readFileSync(file, 'utf8')).filter((l) => l.includes(DSIH));
      if (hits.length > 0) offenders.push(`${file}: ${hits.length} hit(s)`);
    }
    expect(offenders).toEqual([]);
  });
});
