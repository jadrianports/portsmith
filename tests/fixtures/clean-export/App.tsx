/**
 * THE CLEAN INGEST FIXTURE — the PIPE-04 "prove green" raw-export corpus (Phase-11 Plan 02).
 * The input-side analog of the minimal/editorial GREEN-on-corpus canary role.
 *
 * Scanned BY FOLDER PATH (the unit test does `path.resolve('tests/fixtures/clean-export')`),
 * never imported into the Next graph. It deliberately contains constructs that COULD
 * false-fire a naive grep scanner but MUST stay green under the AST+regex hybrid:
 *   - a legal React `onClick={}` JSX attribute (NOT an HTML inline `on<word>=` handler),
 *   - a relative import (in-repo trust, never an unknown dependency),
 *   - a Tailwind-style class string with a `/` (`p-4 text-fg/80`) that is NOT a `//host`,
 *   - the banned substrings only INSIDE this prose comment (comment-stripped before regex).
 *
 * It carries ZERO must-strip findings: no `VITE_*` secret, no hardcoded JWT, no
 * `dangerouslySetInnerHTML`, no external (non-Supabase) origin, no inline string handler,
 * no `eval`/`new Function`. The green assertion is `findings.filter(f => f.tier ===
 * 'must-strip').length === 0` (an unknown-dep FLAG would be permitted, but this fixture's
 * package.json is fully allowlisted so there are none).
 */

// A relative (in-repo) import — `isInRepoImport` treats this as first-party source, so it
// is NOT an unknown dependency. The module need not exist; the scanner reads the specifier.
import { Section } from './section';

export default function App() {
  return (
    <main className="p-4 text-fg/80">
      <h1>Marketing portfolio</h1>
      <button onClick={() => console.log('legal react handler')}>Get in touch</button>
      <Section />
    </main>
  );
}
