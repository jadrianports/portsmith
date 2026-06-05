/**
 * THE DIRTY INGEST FIXTURE — the PIPE-04 "prove RED" raw-Lovable-export corpus (Phase-11
 * Plan 02 / D-P11-07). The input-side twin of `tests/fixtures/broken-template/index.tsx`.
 *
 * This is a DELIBERATELY-DIRTY raw export file that trips MULTIPLE distinct `scanIngest`
 * must-strip rules. It exists SOLELY so the input scanner can assert a witnessed RED (a
 * scanner that has only ever passed is untrusted). The dirty `package.json` (sibling) adds
 * the `unknown-dependency` FLAG over `react-quill`.
 *
 * HARD CONSTRAINT (mirrors broken-template:8-14): this folder lives ONLY under
 * `tests/fixtures/` — it is ABSENT from every registry and is NEVER imported into the Next
 * graph. The scanner loads it BY FOLDER PATH (the unit test does `path.resolve(
 * 'tests/fixtures/dirty-export')`). It is scanned as TEXT/AST, so it does NOT need to
 * compile, resolve its imports, or render — every break is a SCANNER-level finding.
 *
 * ┌─────────────────────────────────────────────────────────────────────────────────────┐
 * │ WHAT EACH RULE TRIPS ON (every break is DELIBERATE — this is the prove-RED corpus):   │
 * │                                                                                       │
 * │  hardcoded-secret  (must-strip) → a `VITE_SUPABASE_ANON_KEY` env-name reference       │
 * │                                   (`\bVITE_[A-Z0-9_]+`) — Vite env names never belong  │
 * │                                   in a Portsmith template (leaked-secret marker).     │
 * │  danger-html       (must-strip) → a `dangerouslySetInnerHTML={{ __html: userBio }}`   │
 * │                                   whose `__html` is a free-form (non-sanctioned)       │
 * │                                   producer. On the raw INPUT side there is NO          │
 * │                                   sanctioned producer (no _kit), so ANY such use is    │
 * │                                   must-strip.                                          │
 * │  external-origin   (must-strip) → an `<img src="https://cdn.evil.example/x.png">`      │
 * │                                   external (non-Supabase-Storage) origin.             │
 * │  inline-handler    (must-strip) → a string `<span onclick="alert(1)">` HTML inline    │
 * │                                   event handler (NOT a React `onClick={}` JSX attr —   │
 * │                                   that is legal and must NOT fire; this is inside a     │
 * │                                   string literal).                                    │
 * │  eval-new-function (must-strip) → an `eval(userExpr)` dynamic code-exec call.          │
 * │                                                                                       │
 * │  unknown-dependency (FLAG)      → `react-quill` in package.json (sibling file).        │
 * └─────────────────────────────────────────────────────────────────────────────────────┘
 */

// A legal React event prop — this MUST NOT trip `inline-handler` (it is a JsxAttribute,
// not a string `on<word>=`). Its presence is the false-positive canary (Pitfall 1).
function LegalButton() {
  return <button onClick={() => console.log('legal react handler')}>Click</button>;
}

export default function App() {
  // hardcoded-secret (must-strip): a `VITE_*` env-name reference inlined in source.
  const KEY = 'VITE_SUPABASE_ANON_KEY';

  // danger-html (must-strip): a free-form `__html` value (non-sanctioned producer).
  const userBio = `<p>${KEY}</p>`;

  // eval-new-function (must-strip): dynamic code execution.
  const userExpr = '1 + 1';
  const computed = eval(userExpr);

  // inline-handler (must-strip): an HTML inline event handler inside a STRING literal
  // (markup the export injects verbatim) — distinct from the legal React onClick above.
  const injectedMarkup = '<span onclick="alert(1)">hover me</span>';

  return (
    <main>
      <LegalButton />
      {/* danger-html: __html does not trace to a sanctioned producer → must-strip. */}
      <div dangerouslySetInnerHTML={{ __html: userBio }} />
      {/* external-origin: a non-Supabase external image origin → must-strip. */}
      <img src="https://cdn.evil.example/x.png" width={1} height={1} />
      {/* inline-handler: the injected string-markup handler. */}
      <section dangerouslySetInnerHTML={{ __html: injectedMarkup }} />
      <p>{String(computed)}</p>
    </main>
  );
}
